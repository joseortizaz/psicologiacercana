// supabase/functions/sync-icd11-diagnoses/index.ts
//
// Sincroniza el catálogo `diagnosis_codes` contra la API pública de la OMS
// (ICD-API / CIE-11), capítulo 06 "Mental, behavioural or neurodevelopmental
// disorders" de la linearización MMS. Ver plan-modulo-psiquiatria-cercana.md,
// sección 2.3, y el comentario en
// supabase/migrations/20260807000002_diagnosis_codes.sql.
//
// Header requerido: Authorization: Bearer <access_token de un super_admin>
//
// Secrets requeridos (supabase secrets set ...):
//   WHO_ICD_CLIENT_ID, WHO_ICD_CLIENT_SECRET
//   (credenciales de https://icd.who.int/icdapi, flujo client_credentials)
//
// Body esperado (JSON, todos los campos opcionales):
//   {
//     "rootUri": "https://id.who.int/icd/release/11/.../mms/...",
//     // Por defecto se auto-descubre el capítulo 06. Si una corrida se
//     // trunca por los límites de abajo, la respuesta incluye
//     // `pendingBranches`: URIs de subárboles no procesados que se pueden
//     // pasar aquí en `rootUri` para continuar la sincronización en otra
//     // invocación (el árbol completo del capítulo 06 es grande y una sola
//     // invocación puede no alcanzar a recorrerlo entero).
//     "maxNodes": 500,      // tope de entidades a procesar en esta corrida
//     "maxDepth": 8,        // profundidad máxima desde rootUri
//     "language": "es"      // Accept-Language pedido a la API de la OMS
//   }
//
// Respuesta 200:
//   {
//     ok: true,
//     chapterUri, chapterTitle,
//     synced: number,          // filas insertadas/actualizadas en diagnosis_codes
//     visited: number,         // entidades de la OMS consultadas en esta corrida
//     truncated: boolean,      // true si se llegó a maxNodes/maxDepth/tiempo
//     pendingBranches: string[], // URIs no procesados (pasar como rootUri para continuar)
//     elapsedMs: number
//   }
//
// NOTA IMPORTANTE: este código se escribió a partir de la documentación
// pública de la ICD-API (https://icd.who.int/icdapi), sin poder probarlo en
// vivo desde este entorno (el sandbox de desarrollo bloquea salidas de red
// hacia icdaccessmanagement.who.int / id.who.int a nivel de proxy). Debe
// probarse contra credenciales reales una vez desplegado, y es esperable
// ajustar detalles (forma exacta de la respuesta de /release/11/mms,
// nombres de campos) según el comportamiento real observado.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const TOKEN_URL = "https://icdaccessmanagement.who.int/connect/token";
const API_BASE = "https://id.who.int";
const MMS_ROOT_URL = `${API_BASE}/icd/release/11/mms`;
const CHAPTER_TITLE_MATCH = /mental,?\s+behavioural\s+or\s+neurodevelopmental\s+disorders/i;

const DEFAULT_MAX_NODES = 500;
const DEFAULT_MAX_DEPTH = 8;
const TIME_BUDGET_MS = 45_000; // deja margen dentro del límite de ejecución del Edge Function
const CONCURRENCY = 5;

interface WhoTitle {
  "@value"?: string;
}

interface WhoEntity {
  "@id"?: string;
  title?: WhoTitle;
  code?: string;
  parent?: string[];
  child?: string[];
}

interface DiagnosisRow {
  system: string;
  code: string;
  title: string;
  parent_code: string | null;
  active: boolean;
}

async function getWhoAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const basicAuth = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=icdapi_access",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`No se pudo obtener el token de la OMS (${res.status}): ${body}`);
  }
  const json = await res.json();
  if (!json.access_token) {
    throw new Error("La respuesta de token de la OMS no incluyó access_token");
  }
  return json.access_token as string;
}

async function fetchWhoEntity(uri: string, token: string, language: string): Promise<WhoEntity> {
  const res = await fetch(uri, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Accept-Language": language,
      "API-Version": "v2",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Error consultando ${uri} (${res.status}): ${body}`);
  }
  return (await res.json()) as WhoEntity;
}

// Resuelve la entidad raíz de la linearización MMS. La API de la OMS puede
// responder de dos formas según se consulte con o sin versión fija:
//   (a) directamente la entidad raíz (con `child`), o
//   (b) un índice de releases (`release: [...]`) del que hay que tomar el
//       más reciente y volver a consultar.
async function resolveMmsRoot(token: string, language: string): Promise<WhoEntity> {
  const first = await fetchWhoEntity(MMS_ROOT_URL, token, language);
  if (Array.isArray(first.child) && first.child.length > 0) {
    return first;
  }
  const releases = (first as unknown as { release?: string[] }).release;
  if (Array.isArray(releases) && releases.length > 0) {
    const latestUri = releases[releases.length - 1];
    return await fetchWhoEntity(latestUri, token, language);
  }
  throw new Error(
    "No se pudo interpretar la respuesta de /icd/release/11/mms (ni 'child' ni 'release' presentes)",
  );
}

async function findChapter06(
  root: WhoEntity,
  token: string,
  language: string,
): Promise<{ uri: string; entity: WhoEntity }> {
  for (const childUri of root.child ?? []) {
    const child = await fetchWhoEntity(childUri, token, language);
    const title = child.title?.["@value"] ?? "";
    if (CHAPTER_TITLE_MATCH.test(title)) {
      return { uri: childUri, entity: child };
    }
  }
  throw new Error(
    "No se encontró el capítulo 'Mental, behavioural or neurodevelopmental disorders' entre los hijos de la raíz MMS",
  );
}

// Pool sencillo de concurrencia acotada para no disparar cientos de fetch en paralelo.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido, use POST" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Falta el header Authorization" }, 401);
  }
  const jwt = authHeader.replace(/^Bearer\s+/i, "");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const whoClientId = Deno.env.get("WHO_ICD_CLIENT_ID");
  const whoClientSecret = Deno.env.get("WHO_ICD_CLIENT_SECRET");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Configuración del servidor incompleta" }, 500);
  }
  if (!whoClientId || !whoClientSecret) {
    return jsonResponse(
      { error: "Faltan las credenciales de la OMS (WHO_ICD_CLIENT_ID / WHO_ICD_CLIENT_SECRET)" },
      500,
    );
  }
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // ---------------------------------------------------------------
  // 0. Solo super_admin puede disparar la sincronización
  // ---------------------------------------------------------------
  const { data: callerAuth, error: callerAuthError } = await supabaseAdmin.auth.getUser(jwt);
  if (callerAuthError || !callerAuth?.user) {
    return jsonResponse({ error: "Token inválido o expirado" }, 401);
  }

  const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
    .from("profiles")
    .select("role, active")
    .eq("id", callerAuth.user.id)
    .single();

  if (callerProfileError || !callerProfile || !callerProfile.active) {
    return jsonResponse({ error: "Perfil del solicitante no encontrado o inactivo" }, 403);
  }
  if (callerProfile.role !== "super_admin") {
    return jsonResponse(
      { error: "Solo super_admin puede sincronizar el catálogo CIE-11" },
      403,
    );
  }

  let payload: {
    rootUri?: string;
    maxNodes?: number;
    maxDepth?: number;
    language?: string;
  };
  try {
    payload = req.body ? await req.json() : {};
  } catch {
    return jsonResponse({ error: "Body inválido, se esperaba JSON" }, 400);
  }

  const language = payload.language?.trim() || "es";
  const maxNodes = payload.maxNodes && payload.maxNodes > 0 ? payload.maxNodes : DEFAULT_MAX_NODES;
  const maxDepth = payload.maxDepth && payload.maxDepth > 0 ? payload.maxDepth : DEFAULT_MAX_DEPTH;

  const startedAt = Date.now();

  try {
    const token = await getWhoAccessToken(whoClientId, whoClientSecret);

    let chapterUri: string;
    let chapterTitle: string;
    let startEntity: WhoEntity;

    if (payload.rootUri) {
      chapterUri = payload.rootUri;
      startEntity = await fetchWhoEntity(chapterUri, token, language);
      chapterTitle = startEntity.title?.["@value"] ?? "(sin título)";
    } else {
      const root = await resolveMmsRoot(token, language);
      const chapter = await findChapter06(root, token, language);
      chapterUri = chapter.uri;
      startEntity = chapter.entity;
      chapterTitle = startEntity.title?.["@value"] ?? "(sin título)";
    }

    // BFS acotado por maxNodes, maxDepth y un presupuesto de tiempo. `codeByUri`
    // guarda el `code` ya resuelto de cada entidad visitada para poder rellenar
    // `parent_code` de sus hijos sin tener que re-consultar al padre.
    const codeByUri = new Map<string, string | null>();
    const rows: DiagnosisRow[] = [];
    const queue: Array<{ uri: string; entity: WhoEntity; depth: number }> = [
      { uri: chapterUri, entity: startEntity, depth: 0 },
    ];
    const visited = new Set<string>([chapterUri]);
    const pendingBranches: string[] = [];
    let truncated = false;

    while (queue.length > 0) {
      if (Date.now() - startedAt > TIME_BUDGET_MS || visited.size >= maxNodes) {
        truncated = true;
        for (const remaining of queue) pendingBranches.push(remaining.uri);
        break;
      }

      const batch = queue.splice(0, Math.min(CONCURRENCY, queue.length));

      for (const item of batch) {
        const { uri, entity, depth } = item;
        const code = entity.code ?? null;
        codeByUri.set(uri, code);
        const title = entity.title?.["@value"];

        if (code && title) {
          const parentUri = entity.parent?.[0];
          const parentCode = parentUri ? codeByUri.get(parentUri) ?? null : null;
          rows.push({ system: "icd11", code, title, parent_code: parentCode, active: true });
        }

        const children = entity.child ?? [];
        if (children.length === 0 || depth >= maxDepth) {
          if (depth >= maxDepth && children.length > 0) {
            pendingBranches.push(...children);
            truncated = true;
          }
          continue;
        }

        if (visited.size + children.length > maxNodes) {
          pendingBranches.push(...children);
          truncated = true;
          continue;
        }

        const fetchedChildren = await mapWithConcurrency(children, CONCURRENCY, async (childUri) => {
          visited.add(childUri);
          const childEntity = await fetchWhoEntity(childUri, token, language);
          return { uri: childUri, entity: childEntity, depth: depth + 1 };
        });
        queue.push(...fetchedChildren);
      }
    }

    let synced = 0;
    const UPSERT_CHUNK = 200;
    for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
      const chunk = rows.slice(i, i + UPSERT_CHUNK);
      const { error: upsertError } = await supabaseAdmin
        .from("diagnosis_codes")
        .upsert(chunk, { onConflict: "system,code" });
      if (upsertError) {
        return jsonResponse(
          {
            error: `Fallo al guardar en diagnosis_codes: ${upsertError.message}`,
            syncedBeforeFailure: synced,
          },
          500,
        );
      }
      synced += chunk.length;
    }

    return jsonResponse(
      {
        ok: true,
        chapterUri,
        chapterTitle,
        synced,
        visited: visited.size,
        truncated,
        pendingBranches,
        elapsedMs: Date.now() - startedAt,
      },
      200,
    );
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Error desconocido sincronizando con la OMS" },
      502,
    );
  }
});
