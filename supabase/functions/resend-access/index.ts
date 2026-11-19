// supabase/functions/resend-access/index.ts
//
// super_admin reenvía el acceso a un usuario cuya invitación caducó o nunca
// llegó. Genera un enlace de restablecimiento de contraseña (un solo uso) y lo
// envía por Resend desde nuestro propio remitente. No cambia datos del perfil.
//
// Header requerido: Authorization: Bearer <access_token de un super_admin>
// Body (JSON): { "userId": "uuid" }
// Respuesta 200: { ok: true, sentTo }   |   error: { error }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { buildAccessLinkEmail, sendEmail } from "../_shared/email.ts";

const DEFAULT_APP_URL = "https://www.cercanard.com";

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

  // Solo super_admin activo
  const { data: callerAuth, error: callerAuthError } = await supabaseAdmin.auth.getUser(jwt);
  if (callerAuthError || !callerAuth?.user) {
    return jsonResponse({ error: "Token inválido o expirado" }, 401);
  }
  const { data: callerProfile } = await supabaseAdmin
    .from("profiles")
    .select("role, active")
    .eq("id", callerAuth.user.id)
    .single();
  if (!callerProfile || !callerProfile.active || callerProfile.role !== "super_admin") {
    return jsonResponse({ error: "Solo super_admin puede reenviar accesos" }, 403);
  }

  let payload: { userId?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Body inválido, se esperaba JSON" }, 400);
  }
  if (!payload.userId) {
    return jsonResponse({ error: "Falta userId" }, 400);
  }

  const { data: target } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, active")
    .eq("id", payload.userId)
    .maybeSingle();
  if (!target) {
    return jsonResponse({ error: "Usuario no encontrado" }, 404);
  }
  if (!target.active) {
    return jsonResponse({ error: "El usuario está inactivo" }, 400);
  }

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email: target.email,
  });
  const tokenHash = linkData?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    return jsonResponse(
      { error: `No se pudo generar el enlace: ${linkError?.message ?? "sin token"}` },
      400,
    );
  }

  const appUrl = (Deno.env.get("APP_URL") ?? DEFAULT_APP_URL).replace(/\/$/, "");
  const link =
    `${appUrl}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=recovery&next=/set-password`;

  const email = buildAccessLinkEmail({ fullName: target.full_name, link });
  const result = await sendEmail({ to: target.email, ...email });
  if (!result.ok) {
    return jsonResponse({ error: `No se pudo enviar el correo: ${result.error}` }, 502);
  }

  return jsonResponse({ ok: true, sentTo: target.email }, 200);
});
