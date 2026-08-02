// supabase/functions/onboard-organization/index.ts
//
// Crea una organización nueva junto con su primer org_admin, en un solo
// paso, usando service_role (bypassa RLS). Necesario porque
// profiles_insert exige que YA exista un org_admin/super_admin en la
// organización -- para una clínica que se registra por primera vez, ese
// admin todavía no existe.
//
// CONTROLADA: solo super_admin puede invocar esta función (decisión de
// negocio: el alta de clínicas nuevas la controla el equipo de
// PsyClinic, no es self-service). Requiere:
//   Authorization: Bearer <access_token de un super_admin>
//
// Body esperado (JSON):
//   {
//     "organizationName": "Clínica Ejemplo",
//     "adminEmail": "admin@ejemplo.com",
//     "adminFullName": "Nombre Apellido",
//     "adminPhone": "+1 809 000 0000"   // opcional
//   }
//
// Respuesta 200: { organizationId, userId }
// El nuevo admin recibe un correo de invitación de Supabase Auth para
// fijar su contraseña (inviteUserByEmail) -- no se maneja password aquí.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

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

  let payload: {
    organizationName?: string;
    adminEmail?: string;
    adminFullName?: string;
    adminPhone?: string;
  };

  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Body inválido, se esperaba JSON" }, 400);
  }

  const { organizationName, adminEmail, adminFullName, adminPhone } = payload;

  if (!organizationName?.trim() || !adminEmail?.trim() || !adminFullName?.trim()) {
    return jsonResponse(
      { error: "organizationName, adminEmail y adminFullName son requeridos" },
      400,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Configuración del servidor incompleta" }, 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // ---------------------------------------------------------------
  // 0. Solo super_admin puede dar de alta organizaciones nuevas
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
      { error: "Solo super_admin puede registrar organizaciones nuevas" },
      403,
    );
  }

  // ---------------------------------------------------------------
  // 1. Crear el usuario de Auth (flujo de invitación por correo)
  // ---------------------------------------------------------------
  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin
    .inviteUserByEmail(adminEmail, { data: { full_name: adminFullName } });

  if (inviteError || !inviteData?.user) {
    return jsonResponse(
      { error: `No se pudo crear el usuario: ${inviteError?.message ?? "error desconocido"}` },
      400,
    );
  }

  const newUserId = inviteData.user.id;

  // ---------------------------------------------------------------
  // 2. Crear la organización
  // ---------------------------------------------------------------
  const { data: org, error: orgError } = await supabaseAdmin
    .from("organizations")
    .insert({ name: organizationName, billing_email: adminEmail })
    .select()
    .single();

  if (orgError || !org) {
    await supabaseAdmin.auth.admin.deleteUser(newUserId);
    return jsonResponse(
      { error: `No se pudo crear la organización: ${orgError?.message ?? "error desconocido"}` },
      400,
    );
  }

  // ---------------------------------------------------------------
  // 3. Crear el perfil de org_admin
  // ---------------------------------------------------------------
  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: newUserId,
    organization_id: org.id,
    role: "org_admin",
    full_name: adminFullName,
    email: adminEmail,
    phone: adminPhone ?? null,
  });

  if (profileError) {
    // Rollback: no dejar una organización huérfana ni un usuario de Auth
    // sin perfil asociado.
    await supabaseAdmin.from("organizations").delete().eq("id", org.id);
    await supabaseAdmin.auth.admin.deleteUser(newUserId);
    return jsonResponse(
      { error: `No se pudo crear el perfil de administrador: ${profileError.message}` },
      400,
    );
  }

  return jsonResponse({ organizationId: org.id, userId: newUserId }, 200);
});
