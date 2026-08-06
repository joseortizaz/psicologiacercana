// supabase/functions/create-signup-upload-slots/index.ts
//
// Primer paso del autoregistro público (botón "Prueba gratuita 14 días").
// Genera un requestId y 3 URLs firmadas de carga (una por documento), para
// que el navegador suba los archivos directo a Storage sin pasar por esta
// función -- evita límites de tamaño de payload en edge functions y no
// requiere exponer ninguna policy de storage.objects a usuarios anónimos.
//
// No requiere autenticación: cualquier visitante puede iniciar un
// autoregistro. El límite de tamaño (10 MiB) y de tipo de archivo
// (jpg/png/pdf) los aplica el bucket mismo (ver migración
// 20260806000000_signup_requests.sql).
//
// Respuesta 200:
//   {
//     requestId,
//     idDocument: { path, token, signedUrl },
//     credentialDocument: { path, token, signedUrl },
//     licenseDocument: { path, token, signedUrl }
//   }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const BUCKET = "signup-documents";
const DOCUMENT_KEYS = ["id-document", "credential-document", "license-document"] as const;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido, use POST" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Configuración del servidor incompleta" }, 500);
  }
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const requestId = crypto.randomUUID();
  const slots: Record<string, { path: string; token: string; signedUrl: string }> = {};

  for (const key of DOCUMENT_KEYS) {
    const path = `${requestId}/${key}`;
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);

    if (error || !data) {
      return jsonResponse(
        {
          error: `No se pudo preparar la carga de archivos: ${error?.message ?? "error desconocido"}`,
        },
        500,
      );
    }

    slots[key] = { path: data.path, token: data.token, signedUrl: data.signedUrl };
  }

  return jsonResponse(
    {
      requestId,
      idDocument: slots["id-document"],
      credentialDocument: slots["credential-document"],
      licenseDocument: slots["license-document"],
    },
    200,
  );
});
