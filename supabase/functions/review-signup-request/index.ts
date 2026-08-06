// supabase/functions/review-signup-request/index.ts
//
// super_admin aprueba o rechaza una solicitud de autoregistro. Al aprobar,
// crea en un solo paso: la organización (con 14 días de prueba), la
// clínica, el usuario de Auth (invitación por correo) y el perfil de
// terapeuta. Al rechazar, solo marca la solicitud con el motivo.
//
// Header requerido: Authorization: Bearer <access_token de un super_admin>
//
// Body esperado (JSON):
//   {
//     "requestId": "uuid",
//     "action": "approve" | "reject",
//     "rejectionReason": "..."   // opcional, solo se usa en reject
//   }
//
// Respuesta 200 (approve): { organizationId, userId }
// Respuesta 200 (reject): { ok: true }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const TRIAL_DAYS = 14;

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
  // 0. Solo super_admin puede revisar solicitudes
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
      { error: "Solo super_admin puede revisar solicitudes de registro" },
      403,
    );
  }

  let payload: { requestId?: string; action?: string; rejectionReason?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Body inválido, se esperaba JSON" }, 400);
  }

  const { requestId, action, rejectionReason } = payload;
  if (!requestId || !action) {
    return jsonResponse({ error: "requestId y action son requeridos" }, 400);
  }
  if (action !== "approve" && action !== "reject") {
    return jsonResponse({ error: "action debe ser 'approve' o 'reject'" }, 400);
  }

  const { data: signupRequest, error: fetchError } = await supabaseAdmin
    .from("signup_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (fetchError || !signupRequest) {
    return jsonResponse({ error: "Solicitud no encontrada" }, 404);
  }
  if (signupRequest.status !== "pending") {
    return jsonResponse({ error: "Esta solicitud ya fue revisada" }, 409);
  }

  // ---------------------------------------------------------------
  // Rechazar
  // ---------------------------------------------------------------
  if (action === "reject") {
    const { error: updateError } = await supabaseAdmin
      .from("signup_requests")
      .update({
        status: "rejected",
        reviewed_by: callerAuth.user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejectionReason?.trim() || null,
      })
      .eq("id", requestId);

    if (updateError) {
      return jsonResponse(
        { error: `No se pudo rechazar la solicitud: ${updateError.message}` },
        400,
      );
    }
    return jsonResponse({ ok: true }, 200);
  }

  // ---------------------------------------------------------------
  // Aprobar: crear organización, clínica, usuario y perfil
  // ---------------------------------------------------------------
  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", signupRequest.email)
    .maybeSingle();

  if (existingProfile) {
    return jsonResponse({ error: "Ya existe una cuenta registrada con este correo." }, 409);
  }

  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: org, error: orgError } = await supabaseAdmin
    .from("organizations")
    .insert({
      name: signupRequest.clinic_name,
      billing_email: signupRequest.email,
      trial_ends_at: trialEndsAt,
    })
    .select()
    .single();

  if (orgError || !org) {
    return jsonResponse(
      { error: `No se pudo crear la organización: ${orgError?.message ?? "error desconocido"}` },
      400,
    );
  }

  const { data: clinic, error: clinicError } = await supabaseAdmin
    .from("clinics")
    .insert({ organization_id: org.id, name: signupRequest.clinic_name })
    .select()
    .single();

  if (clinicError || !clinic) {
    await supabaseAdmin.from("organizations").delete().eq("id", org.id);
    return jsonResponse(
      { error: `No se pudo crear la clínica: ${clinicError?.message ?? "error desconocido"}` },
      400,
    );
  }

  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin
    .inviteUserByEmail(signupRequest.email, { data: { full_name: signupRequest.full_name } });

  if (inviteError || !inviteData?.user) {
    await supabaseAdmin.from("clinics").delete().eq("id", clinic.id);
    await supabaseAdmin.from("organizations").delete().eq("id", org.id);
    return jsonResponse(
      { error: `No se pudo crear el usuario: ${inviteError?.message ?? "error desconocido"}` },
      400,
    );
  }

  const newUserId = inviteData.user.id;

  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: newUserId,
    organization_id: org.id,
    clinic_id: clinic.id,
    role: "therapist",
    full_name: signupRequest.full_name,
    email: signupRequest.email,
    phone: signupRequest.phone,
    license_number: signupRequest.license_number,
    specialty: signupRequest.specialty,
    invited_by: callerAuth.user.id,
  });

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(newUserId);
    await supabaseAdmin.from("clinics").delete().eq("id", clinic.id);
    await supabaseAdmin.from("organizations").delete().eq("id", org.id);
    return jsonResponse({ error: `No se pudo crear el perfil: ${profileError.message}` }, 400);
  }

  const { error: reviewUpdateError } = await supabaseAdmin
    .from("signup_requests")
    .update({
      status: "approved",
      reviewed_by: callerAuth.user.id,
      reviewed_at: new Date().toISOString(),
      created_organization_id: org.id,
      created_user_id: newUserId,
    })
    .eq("id", requestId);

  if (reviewUpdateError) {
    // La cuenta ya se creó correctamente; no revertimos por un fallo al
    // marcar la solicitud, solo lo reportamos.
    return jsonResponse(
      {
        organizationId: org.id,
        userId: newUserId,
        warning: `La cuenta se creó pero no se pudo actualizar el estado de la solicitud: ${reviewUpdateError.message}`,
      },
      200,
    );
  }

  return jsonResponse({ organizationId: org.id, userId: newUserId }, 200);
});
