// supabase/functions/review-signup-request/index.ts
//
// super_admin aprueba o rechaza una solicitud de autoregistro. Al aprobar,
// crea en un solo paso: la organización en estado 'trial' (la ventana de 14
// días arranca en el momento exacto de la aprobación; la fija el trigger
// apply_trial_window de la base de datos), la clínica, el usuario de Auth
// (invitación por correo para crear contraseña) y el perfil de terapeuta.
// Al rechazar, marca la solicitud con el motivo.
//
// En ambos casos se le envía un correo al solicitante (ver _shared/email.ts).
// Un fallo de envío NO revierte la decisión: la respuesta incluye
// emailSent: false y emailError para que el panel avise al super_admin.
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
// Respuesta 200 (approve): { organizationId, userId, trialEndsAt, emailSent, emailError? }
// Respuesta 200 (reject): { ok: true, emailSent, emailError? }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { buildApprovalEmail, buildRejectionEmail, sendEmail } from "../_shared/email.ts";

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

    const rejection = buildRejectionEmail({
      fullName: signupRequest.full_name,
      reason: rejectionReason ?? null,
    });
    const emailResult = await sendEmail({ to: signupRequest.email, ...rejection });

    return jsonResponse(
      { ok: true, emailSent: emailResult.ok, ...(emailResult.ok ? {} : { emailError: emailResult.error }) },
      200,
    );
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

  // subscription_status = 'trial': el trigger apply_trial_window fija
  // trial_started_at = ahora y trial_ends_at = ahora + 14 días. El plan queda
  // en el valor por defecto (Esencial) hasta que el super_admin lo cambie.
  const { data: org, error: orgError } = await supabaseAdmin
    .from("organizations")
    .insert({
      name: signupRequest.clinic_name,
      billing_email: signupRequest.email,
      subscription_status: "trial",
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
    whatsapp_number: signupRequest.whatsapp_number ?? null,
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

  // Correo de aprobación. Se envía aunque el UPDATE de estado de arriba haya
  // fallado: la cuenta ya existe y la persona debe enterarse.
  const approval = buildApprovalEmail({
    fullName: signupRequest.full_name,
    clinicName: signupRequest.clinic_name,
    trialEndsAt: org.trial_ends_at,
  });
  const emailResult = await sendEmail({ to: signupRequest.email, ...approval });

  return jsonResponse(
    {
      organizationId: org.id,
      userId: newUserId,
      trialEndsAt: org.trial_ends_at,
      emailSent: emailResult.ok,
      ...(emailResult.ok ? {} : { emailError: emailResult.error }),
      // La cuenta ya se creó correctamente; no revertimos por un fallo al
      // marcar la solicitud, solo lo reportamos.
      ...(reviewUpdateError
        ? {
            warning: `La cuenta se creó pero no se pudo actualizar el estado de la solicitud: ${reviewUpdateError.message}`,
          }
        : {}),
    },
    200,
  );
});
