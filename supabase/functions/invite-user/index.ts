// supabase/functions/invite-user/index.ts
//
// Un org_admin invita personal a SU propia organización; un super_admin
// puede invitar a cualquier organización indicando organizationId.
// Valida rol del solicitante, y que la clínica indicada (si aplica)
// pertenezca a la organización destino.
//
// Header requerido: Authorization: Bearer <access_token del solicitante>
//
// Body esperado (JSON):
//   {
//     "email": "nuevo@ejemplo.com",
//     "fullName": "Nombre Apellido",
//     "role": "therapist" | "assistant" | "supervisor" | "org_admin",
//     "clinicId": "uuid",           // requerido para therapist/assistant/supervisor
//     "organizationId": "uuid",     // solo si quien invita es super_admin
//     "phone": "...",               // opcional
//     "licenseNumber": "...",       // opcional, para terapeutas
//     "specialty": "..."            // opcional, para terapeutas
//   }
//
// Respuesta 200: { userId, organizationId }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const ALLOWED_ROLES = ["org_admin", "therapist", "assistant", "supervisor"] as const;
const CLINIC_REQUIRED_ROLES = ["therapist", "assistant", "supervisor"];

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

  // ---------------------------------------------------------------
  // 1. Identificar y validar quién llama
  // ---------------------------------------------------------------
  const { data: callerAuth, error: callerAuthError } = await supabaseAdmin.auth.getUser(jwt);
  if (callerAuthError || !callerAuth?.user) {
    return jsonResponse({ error: "Token inválido o expirado" }, 401);
  }

  const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
    .from("profiles")
    .select("role, organization_id, clinic_id, active")
    .eq("id", callerAuth.user.id)
    .single();

  if (callerProfileError || !callerProfile || !callerProfile.active) {
    return jsonResponse({ error: "Perfil del solicitante no encontrado o inactivo" }, 403);
  }

  if (!["org_admin", "super_admin"].includes(callerProfile.role)) {
    return jsonResponse({ error: "Solo org_admin o super_admin pueden invitar usuarios" }, 403);
  }

  // ---------------------------------------------------------------
  // 2. Leer y validar el body
  // ---------------------------------------------------------------
  let payload: {
    email?: string;
    fullName?: string;
    role?: string;
    clinicId?: string;
    organizationId?: string;
    phone?: string;
    licenseNumber?: string;
    specialty?: string;
  };

  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Body inválido, se esperaba JSON" }, 400);
  }

  const { email, fullName, role, clinicId, organizationId, phone, licenseNumber, specialty } = payload;

  if (!email?.trim() || !fullName?.trim() || !role) {
    return jsonResponse({ error: "email, fullName y role son requeridos" }, 400);
  }
  if (!(ALLOWED_ROLES as readonly string[]).includes(role)) {
    return jsonResponse({ error: `role debe ser uno de: ${ALLOWED_ROLES.join(", ")}` }, 400);
  }
  if (CLINIC_REQUIRED_ROLES.includes(role) && !clinicId) {
    return jsonResponse({ error: `El rol ${role} requiere clinicId` }, 400);
  }

  // org_admin solo puede invitar dentro de su propia organización;
  // super_admin debe indicar explícitamente a cuál organización.
  let targetOrgId: string;
  if (callerProfile.role === "org_admin") {
    targetOrgId = callerProfile.organization_id as string;
  } else {
    if (!organizationId) {
      return jsonResponse({ error: "super_admin debe indicar organizationId" }, 400);
    }
    targetOrgId = organizationId;
  }

  // Si se especificó clínica, confirmar que pertenece a la organización destino
  if (clinicId) {
    const { data: clinic, error: clinicError } = await supabaseAdmin
      .from("clinics")
      .select("id")
      .eq("id", clinicId)
      .eq("organization_id", targetOrgId)
      .maybeSingle();

    if (clinicError || !clinic) {
      return jsonResponse({ error: "clinicId no pertenece a la organización destino" }, 400);
    }
  }

  // ---------------------------------------------------------------
  // 3. Crear el usuario de Auth (invitación por correo)
  // ---------------------------------------------------------------
  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin
    .inviteUserByEmail(email, { data: { full_name: fullName } });

  if (inviteError || !inviteData?.user) {
    return jsonResponse(
      { error: `No se pudo invitar al usuario: ${inviteError?.message ?? "error desconocido"}` },
      400,
    );
  }

  const newUserId = inviteData.user.id;

  // ---------------------------------------------------------------
  // 4. Crear el perfil
  // ---------------------------------------------------------------
  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: newUserId,
    organization_id: targetOrgId,
    clinic_id: clinicId ?? null,
    role,
    full_name: fullName,
    email,
    phone: phone ?? null,
    license_number: licenseNumber ?? null,
    specialty: specialty ?? null,
    invited_by: callerAuth.user.id,
  });

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(newUserId);
    return jsonResponse({ error: `No se pudo crear el perfil: ${profileError.message}` }, 400);
  }

  return jsonResponse({ userId: newUserId, organizationId: targetOrgId }, 200);
});
