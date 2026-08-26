// supabase/functions/invite-user/index.ts
//
// Un org_admin (o cualquier usuario con capacidad administrativa --
// role = 'org_admin' o is_org_admin = true, ver is_org_admin_or_super() en
// la base de datos) invita personal a SU propia organización; un
// super_admin puede invitar a cualquier organización indicando
// organizationId. Valida rol del solicitante, y que la clínica indicada (si
// aplica) pertenezca a la organización destino.
//
// Cambio respecto a la versión anterior (ver
// plan-independientes-y-credenciales-cercana.md, sección B.2): en vez de
// invitar por correo con inviteUserByEmail() -- la persona invitada elegía
// su propia contraseña al hacer clic en el enlace --, ahora el
// administrador crea el usuario con una contraseña temporal generada por el
// sistema. Esa contraseña se devuelve UNA SOLA VEZ en la respuesta para que
// el frontend la muestre al admin, quien la comparte por el canal que
// prefiera (no necesariamente correo). El perfil nuevo queda con
// must_change_password = true, así que la persona invitada queda forzada a
// cambiarla en su primer login antes de ver cualquier otra pantalla de la
// app (ver /change-password y app/(protected)/layout.tsx).
//
// El flujo de invitación por correo (inviteUserByEmail + /auth/confirm +
// /set-password) NO se elimina del proyecto: sigue intacto para
// onboard-organization. Solo se deja de usar aquí.
//
// Header requerido: Authorization: Bearer <access_token del solicitante>
//
// Body esperado (JSON):
//   {
//     "email": "nuevo@ejemplo.com",
//     "fullName": "Nombre Apellido",
//     "role": "therapist" | "assistant" | "supervisor" | "org_admin" | "psychiatrist",
//     "clinicId": "uuid",           // requerido para roles clínicos/asistente/supervisor
//     "organizationId": "uuid",     // solo si quien invita es super_admin
//     "phone": "...",               // opcional
//     "licenseNumber": "...",       // opcional, para terapeutas/psiquiatras
//     "specialty": "..."            // opcional, para terapeutas/psiquiatras
//   }
//
// Respuesta 200: { userId, organizationId, temporaryPassword }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const ALLOWED_ROLES = ["org_admin", "therapist", "psychiatrist", "assistant", "supervisor"] as const;
const CLINIC_REQUIRED_ROLES = ["therapist", "psychiatrist", "assistant", "supervisor"];

// Alfabeto sin caracteres ambiguos (0/O, 1/l/I) -- la contraseña se va a
// leer y transcribir a mano en más de un caso.
const PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";

function generateTemporaryPassword(length = 16): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length];
  }
  return password;
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
    .select("role, organization_id, clinic_id, active, is_org_admin")
    .eq("id", callerAuth.user.id)
    .single();

  if (callerProfileError || !callerProfile || !callerProfile.active) {
    return jsonResponse({ error: "Perfil del solicitante no encontrado o inactivo" }, 403);
  }

  const callerHasAdminCapacity =
    callerProfile.role === "org_admin" || callerProfile.role === "super_admin" || callerProfile.is_org_admin;

  if (!callerHasAdminCapacity) {
    return jsonResponse(
      { error: "Solo un usuario con capacidad administrativa puede invitar personal" },
      403,
    );
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

  // org_admin (o un is_org_admin) solo puede invitar dentro de su propia
  // organización; super_admin debe indicar explícitamente a cuál
  // organización.
  let targetOrgId: string;
  if (callerProfile.role === "super_admin") {
    if (!organizationId) {
      return jsonResponse({ error: "super_admin debe indicar organizationId" }, 400);
    }
    targetOrgId = organizationId;
  } else {
    targetOrgId = callerProfile.organization_id as string;
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
  // 3. Crear el usuario de Auth con contraseña temporal generada por el
  //    sistema -- ya no inviteUserByEmail(). email_confirm: true para que
  //    pueda iniciar sesión de inmediato, sin esperar confirmación por
  //    correo.
  // ---------------------------------------------------------------
  const temporaryPassword = generateTemporaryPassword();

  const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError || !createdUser?.user) {
    return jsonResponse(
      { error: `No se pudo crear el usuario: ${createError?.message ?? "error desconocido"}` },
      400,
    );
  }

  const newUserId = createdUser.user.id;

  // ---------------------------------------------------------------
  // 4. Crear el perfil, con must_change_password = true
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
    must_change_password: true,
  });

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(newUserId);
    return jsonResponse({ error: `No se pudo crear el perfil: ${profileError.message}` }, 400);
  }

  return jsonResponse({ userId: newUserId, organizationId: targetOrgId, temporaryPassword }, 200);
});
