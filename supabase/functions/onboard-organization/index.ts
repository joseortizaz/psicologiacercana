// supabase/functions/onboard-organization/index.ts
//
// Crea una organización nueva junto con su primer usuario, en un solo paso,
// usando service_role (bypassa RLS). Necesario porque profiles_insert exige
// que YA exista un org_admin/super_admin (o un is_org_admin) en la
// organización -- para una organización que se registra por primera vez,
// ese usuario todavía no existe.
//
// CONTROLADA: solo super_admin puede invocar esta función (decisión de
// negocio: el alta de organizaciones nuevas la controla el equipo de
// Cercana, no es self-service). Requiere:
//   Authorization: Bearer <access_token de un super_admin>
//
// Body esperado (JSON), según accountType:
//
//   accountType = "clinic" (comportamiento histórico, sin cambios):
//   {
//     "accountType": "clinic",
//     "organizationName": "Clínica Ejemplo",
//     "adminEmail": "admin@ejemplo.com",
//     "adminFullName": "Nombre Apellido",
//     "adminPhone": "+1 809 000 0000"   // opcional
//   }
//   -> crea la organización y un usuario con role = "org_admin"
//      (is_org_admin queda en false por default; ya tiene acceso admin vía
//      role = "org_admin"). Sin acceso clínico -- pensado para clínicas con
//      varias personas, donde el admin administra y otros atienden.
//
//   accountType = "independent" (psicólogo/psiquiatra que se registra
//   solo -- ver plan-independientes-y-credenciales-cercana.md, sección A.2):
//   {
//     "accountType": "independent",
//     "organizationName": "Clínica Ejemplo",
//     "adminEmail": "admin@ejemplo.com",
//     "adminFullName": "Nombre Apellido",
//     "adminPhone": "+1 809 000 0000",  // opcional
//     "clinicalRole": "therapist" | "psychiatrist"
//   }
//   -> crea la organización, una sucursal por defecto dentro de ella (mismo
//      nombre de la organización -- obligatorio: clinic_required_for_
//      clinic_staff exige clinic_id para therapist/psychiatrist), y un
//      usuario con role = clinicalRole + is_org_admin = true + clinic_id =
//      la sucursal recién creada. Esa misma cuenta administra su "clínica"
//      de una persona Y atiende pacientes.
//
// Si cualquier paso falla, se revierte todo lo creado hasta ese punto
// (organización, sucursal si aplica, usuario de Auth).
//
// Respuesta 200: { organizationId, userId, clinicId? }
// El nuevo usuario recibe un correo de invitación de Supabase Auth para
// fijar su contraseña (inviteUserByEmail) -- no se maneja password aquí,
// en ninguno de los dos flujos.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const CLINICAL_ROLES = ["therapist", "psychiatrist"] as const;
type ClinicalRole = (typeof CLINICAL_ROLES)[number];

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
    accountType?: "clinic" | "independent";
    organizationName?: string;
    adminEmail?: string;
    adminFullName?: string;
    adminPhone?: string;
    clinicalRole?: string;
  };

  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Body inválido, se esperaba JSON" }, 400);
  }

  const {
    organizationName,
    adminEmail,
    adminFullName,
    adminPhone,
    clinicalRole,
  } = payload;
  const accountType = payload.accountType ?? "clinic";

  if (accountType !== "clinic" && accountType !== "independent") {
    return jsonResponse({ error: "accountType debe ser 'clinic' o 'independent'" }, 400);
  }

  if (!organizationName?.trim() || !adminEmail?.trim() || !adminFullName?.trim()) {
    return jsonResponse(
      { error: "organizationName, adminEmail y adminFullName son requeridos" },
      400,
    );
  }

  if (accountType === "independent" && !CLINICAL_ROLES.includes(clinicalRole as ClinicalRole)) {
    return jsonResponse(
      { error: `accountType 'independent' requiere clinicalRole: ${CLINICAL_ROLES.join(" | ")}` },
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
  // 1. Crear el usuario de Auth (flujo de invitación por correo, igual en
  //    ambos accountType)
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
  // 3. accountType = "independent": crear la sucursal por defecto.
  //    Obligatorio -- clinic_required_for_clinic_staff exige clinic_id
  //    para therapist/psychiatrist; sin este paso el INSERT del perfil
  //    (paso 4) quedaría rechazado por ese constraint.
  // ---------------------------------------------------------------
  let defaultClinicId: string | null = null;

  if (accountType === "independent") {
    const { data: clinic, error: clinicError } = await supabaseAdmin
      .from("clinics")
      .insert({ organization_id: org.id, name: organizationName })
      .select()
      .single();

    if (clinicError || !clinic) {
      await supabaseAdmin.from("organizations").delete().eq("id", org.id);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return jsonResponse(
        { error: `No se pudo crear la sucursal por defecto: ${clinicError?.message ?? "error desconocido"}` },
        400,
      );
    }

    defaultClinicId = clinic.id;
  }

  // ---------------------------------------------------------------
  // 4. Crear el perfil
  // ---------------------------------------------------------------
  const profileInsert =
    accountType === "independent"
      ? {
          id: newUserId,
          organization_id: org.id,
          clinic_id: defaultClinicId,
          role: clinicalRole,
          is_org_admin: true,
          full_name: adminFullName,
          email: adminEmail,
          phone: adminPhone ?? null,
        }
      : {
          id: newUserId,
          organization_id: org.id,
          role: "org_admin",
          full_name: adminFullName,
          email: adminEmail,
          phone: adminPhone ?? null,
        };

  const { error: profileError } = await supabaseAdmin.from("profiles").insert(profileInsert);

  if (profileError) {
    // Rollback: no dejar una organización/sucursal huérfana ni un usuario
    // de Auth sin perfil asociado.
    if (defaultClinicId) {
      await supabaseAdmin.from("clinics").delete().eq("id", defaultClinicId);
    }
    await supabaseAdmin.from("organizations").delete().eq("id", org.id);
    await supabaseAdmin.auth.admin.deleteUser(newUserId);
    return jsonResponse(
      { error: `No se pudo crear el perfil: ${profileError.message}` },
      400,
    );
  }

  return jsonResponse(
    { organizationId: org.id, userId: newUserId, clinicId: defaultClinicId ?? undefined },
    200,
  );
});
