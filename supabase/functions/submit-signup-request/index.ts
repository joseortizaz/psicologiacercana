// supabase/functions/submit-signup-request/index.ts
//
// Segundo paso del autoregistro público: una vez que el navegador ya subió
// los 3 documentos usando las URLs firmadas de create-signup-upload-slots,
// esta función confirma que están los 3 archivos y crea la fila en
// signup_requests (status 'pending'). No crea organización, clínica ni
// usuario -- eso ocurre solo cuando super_admin aprueba la solicitud
// (ver review-signup-request).
//
// No requiere autenticación.
//
// Body esperado (JSON):
//   {
//     "requestId": "uuid",       // el mismo que devolvió create-signup-upload-slots
//     "fullName": "...",
//     "email": "...",
//     "phone": "...",            // opcional
//     "licenseNumber": "...",
//     "specialty": "...",        // opcional
//     "clinicName": "..."
//   }
//
// Respuesta 200: { requestId }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const BUCKET = "signup-documents";
const REQUIRED_DOCUMENTS = ["id-document", "credential-document", "license-document"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido, use POST" }, 405);
  }

  let payload: {
    requestId?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    licenseNumber?: string;
    specialty?: string;
    clinicName?: string;
  };

  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Body inválido, se esperaba JSON" }, 400);
  }

  const { requestId, fullName, email, phone, licenseNumber, specialty, clinicName } = payload;

  if (!requestId || !UUID_RE.test(requestId)) {
    return jsonResponse({ error: "requestId inválido" }, 400);
  }
  if (!fullName?.trim() || !email?.trim() || !licenseNumber?.trim() || !clinicName?.trim()) {
    return jsonResponse(
      { error: "fullName, email, licenseNumber y clinicName son requeridos" },
      400,
    );
  }

  const emailTrimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
    return jsonResponse({ error: "El correo no es válido" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Configuración del servidor incompleta" }, 500);
  }
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // Confirmar que los 3 documentos ya se subieron para este requestId.
  const { data: files, error: listError } = await supabaseAdmin.storage
    .from(BUCKET)
    .list(requestId, { limit: 10 });

  if (listError) {
    return jsonResponse(
      { error: `No se pudo verificar los documentos: ${listError.message}` },
      500,
    );
  }

  const uploadedNames = new Set((files ?? []).map((f) => f.name));
  const missing = REQUIRED_DOCUMENTS.filter((name) => !uploadedNames.has(name));
  if (missing.length > 0) {
    return jsonResponse(
      { error: "Faltan documentos por subir. Vuelve a intentar cargarlos." },
      400,
    );
  }

  // Evitar duplicados: ya existe una cuenta activa, o ya hay una solicitud
  // pendiente, con este correo.
  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", emailTrimmed)
    .maybeSingle();

  if (existingProfile) {
    return jsonResponse({ error: "Ya existe una cuenta registrada con este correo." }, 409);
  }

  const { data: existingRequest } = await supabaseAdmin
    .from("signup_requests")
    .select("id")
    .eq("email", emailTrimmed)
    .eq("status", "pending")
    .maybeSingle();

  if (existingRequest) {
    return jsonResponse(
      { error: "Ya hay una solicitud pendiente con este correo. Espera a que sea revisada." },
      409,
    );
  }

  const { error: insertError } = await supabaseAdmin.from("signup_requests").insert({
    id: requestId,
    full_name: fullName.trim(),
    email: emailTrimmed,
    phone: phone?.trim() || null,
    license_number: licenseNumber.trim(),
    specialty: specialty?.trim() || null,
    clinic_name: clinicName.trim(),
    id_document_path: `${requestId}/id-document`,
    credential_document_path: `${requestId}/credential-document`,
    license_document_path: `${requestId}/license-document`,
  });

  if (insertError) {
    return jsonResponse(
      { error: `No se pudo registrar la solicitud: ${insertError.message}` },
      400,
    );
  }

  return jsonResponse({ requestId }, 200);
});
