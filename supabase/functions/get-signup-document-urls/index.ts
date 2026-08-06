// supabase/functions/get-signup-document-urls/index.ts
//
// super_admin obtiene URLs firmadas de corta duración (5 minutos) para ver
// los 3 documentos adjuntos a una solicitud de autoregistro. El bucket es
// privado, así que estas son la única forma de verlos.
//
// Header requerido: Authorization: Bearer <access_token de un super_admin>
// Body: { "requestId": "uuid" }
// Respuesta 200: { idDocumentUrl, credentialDocumentUrl, licenseDocumentUrl }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const BUCKET = "signup-documents";
const URL_TTL_SECONDS = 300;

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
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Configuración del servidor incompleta" }, 500);
  }
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

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
    return jsonResponse({ error: "Solo super_admin puede ver estos documentos" }, 403);
  }

  let payload: { requestId?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Body inválido, se esperaba JSON" }, 400);
  }

  if (!payload.requestId) {
    return jsonResponse({ error: "requestId es requerido" }, 400);
  }

  const { data: signupRequest, error: fetchError } = await supabaseAdmin
    .from("signup_requests")
    .select("id_document_path, credential_document_path, license_document_path")
    .eq("id", payload.requestId)
    .single();

  if (fetchError || !signupRequest) {
    return jsonResponse({ error: "Solicitud no encontrada" }, 404);
  }

  const paths = [
    signupRequest.id_document_path,
    signupRequest.credential_document_path,
    signupRequest.license_document_path,
  ];

  const { data: signedUrls, error: signError } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrls(paths, URL_TTL_SECONDS);

  if (signError || !signedUrls) {
    return jsonResponse(
      { error: `No se pudieron generar los enlaces: ${signError?.message ?? "error desconocido"}` },
      500,
    );
  }

  return jsonResponse(
    {
      idDocumentUrl: signedUrls[0]?.signedUrl ?? null,
      credentialDocumentUrl: signedUrls[1]?.signedUrl ?? null,
      licenseDocumentUrl: signedUrls[2]?.signedUrl ?? null,
    },
    200,
  );
});
