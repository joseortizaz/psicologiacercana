// supabase/functions/_shared/email.ts
//
// Envío de correos transaccionales de la app (aprobación/rechazo de
// solicitudes de registro) a través de la API de Resend.
//
// Los correos de AUTENTICACIÓN (invitación para crear contraseña,
// recuperación) NO pasan por aquí: los envía Supabase Auth con el SMTP de
// Resend configurado en el dashboard. Este módulo es solo para correos que
// la app dispara por su cuenta.
//
// Secretos de la función (supabase secrets set ...):
//   RESEND_API_KEY   obligatorio. API key de Resend con permiso de envío.
//   EMAIL_FROM       opcional. Por defecto "Cercana <no-reply@mail.cercanard.com>"
//                    (el dominio mail.cercanard.com es el verificado en Resend).
//   APP_URL          opcional. Por defecto "https://www.cercanard.com".
//   SUPPORT_EMAIL    opcional. Por defecto "info@cercanard.com".
//
// Un fallo de envío NUNCA debe deshacer la aprobación/rechazo de la
// solicitud: por eso sendEmail() no lanza, devuelve { ok, error }, y quien
// la llama decide cómo reportarlo.

const DEFAULT_FROM = "Cercana <no-reply@mail.cercanard.com>";
const DEFAULT_APP_URL = "https://www.cercanard.com";
const DEFAULT_SUPPORT_EMAIL = "info@cercanard.com";
const TIME_ZONE = "America/Santo_Domingo";

export type SendEmailResult = { ok: true } | { ok: false; error: string };

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendEmailResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY no está configurada en la función" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("EMAIL_FROM") ?? DEFAULT_FROM,
        to: [params.to],
        reply_to: supportEmail(),
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { ok: false, error: `Resend respondió ${response.status}: ${detail.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error de red al enviar el correo" };
  }
}

function supportEmail(): string {
  return Deno.env.get("SUPPORT_EMAIL") ?? DEFAULT_SUPPORT_EMAIL;
}

function appUrl(): string {
  return (Deno.env.get("APP_URL") ?? DEFAULT_APP_URL).replace(/\/+$/, "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Fecha y hora en la zona horaria de la app (no la del servidor, que es UTC).
function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: TIME_ZONE,
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(iso));
}

// Marco común de los correos: mismo encabezado y pie, estilos en línea (los
// clientes de correo no soportan hojas de estilo externas).
function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#FAF7F2;font-family:Arial,Helvetica,sans-serif;color:#12242A;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FAF7F2;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #DFD8C9;border-radius:8px;">
            <tr>
              <td style="padding:24px 32px;border-bottom:1px solid #DFD8C9;">
                <span style="font-size:22px;font-weight:bold;color:#173A3F;">Cercana</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;font-size:15px;line-height:1.6;">
                <h1 style="margin:0 0 16px;font-size:20px;color:#173A3F;">${escapeHtml(title)}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;border-top:1px solid #DFD8C9;font-size:12px;color:#12242A99;">
                ¿Dudas? Escríbenos a
                <a href="mailto:${escapeHtml(supportEmail())}" style="color:#173A3F;">${escapeHtml(supportEmail())}</a>.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildApprovalEmail(params: {
  fullName: string;
  clinicName: string;
  trialEndsAt: string;
}): { subject: string; html: string; text: string } {
  const endsAt = formatDateTime(params.trialEndsAt);
  const loginUrl = `${appUrl()}/login`;

  const html = layout(
    "¡Tu solicitud fue aprobada!",
    `<p>Hola ${escapeHtml(params.fullName)},</p>
     <p>Revisamos tu solicitud y tu cuenta de <strong>${escapeHtml(params.clinicName)}</strong> en Cercana ya está lista.</p>
     <p>Tu <strong>prueba gratuita de 14 días</strong> comenzó hoy y termina el <strong>${escapeHtml(endsAt)}</strong> (hora de República Dominicana).</p>
     <p><strong>Siguiente paso:</strong> además de este mensaje, recibirás otro correo de Cercana con un enlace para crear tu contraseña (puede llegar antes o después de este). Si no lo ves, revisa tu carpeta de spam.</p>
     <p style="margin:24px 0;">
       <a href="${escapeHtml(loginUrl)}" style="background:#173A3F;color:#FAF7F2;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold;display:inline-block;">Ir a Cercana</a>
     </p>
     <p>Si tienes preguntas sobre los planes disponibles, escríbenos y te ayudamos a elegir el que mejor se adapte a tu práctica.</p>`,
  );

  const text = [
    `Hola ${params.fullName},`,
    "",
    `Revisamos tu solicitud y tu cuenta de ${params.clinicName} en Cercana ya está lista.`,
    `Tu prueba gratuita de 14 días comenzó hoy y termina el ${endsAt} (hora de República Dominicana).`,
    "",
    "Siguiente paso: además de este mensaje, recibirás otro correo de Cercana con un enlace para crear tu contraseña (puede llegar antes o después de este). Si no lo ves, revisa tu carpeta de spam.",
    "",
    `Ir a Cercana: ${loginUrl}`,
    "",
    "Si tienes preguntas sobre los planes disponibles, escríbenos y te ayudamos a elegir el que mejor se adapte a tu práctica.",
    "",
    `¿Dudas? Escríbenos a ${supportEmail()}.`,
  ].join("\n");

  return { subject: "Tu solicitud en Cercana fue aprobada", html, text };
}

export function buildRejectionEmail(params: {
  fullName: string;
  reason: string | null;
}): { subject: string; html: string; text: string } {
  const registroUrl = `${appUrl()}/registro`;
  const reason = params.reason?.trim() || null;

  const html = layout(
    "Sobre tu solicitud de registro",
    `<p>Hola ${escapeHtml(params.fullName)},</p>
     <p>Gracias por tu interés en Cercana. Después de revisar tu solicitud, por ahora no pudimos aprobarla.</p>
     ${
       reason
         ? `<p><strong>Motivo:</strong> ${escapeHtml(reason)}</p>`
         : ""
     }
     <p>Si crees que se trata de un error, o si ya tienes lista la documentación que falta, puedes enviar una nueva solicitud o responder a este correo y con gusto la revisamos de nuevo.</p>
     <p style="margin:24px 0;">
       <a href="${escapeHtml(registroUrl)}" style="background:#173A3F;color:#FAF7F2;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold;display:inline-block;">Enviar una nueva solicitud</a>
     </p>`,
  );

  const text = [
    `Hola ${params.fullName},`,
    "",
    "Gracias por tu interés en Cercana. Después de revisar tu solicitud, por ahora no pudimos aprobarla.",
    ...(reason ? ["", `Motivo: ${reason}`] : []),
    "",
    "Si crees que se trata de un error, o si ya tienes lista la documentación que falta, puedes enviar una nueva solicitud o responder a este correo y con gusto la revisamos de nuevo.",
    "",
    `Enviar una nueva solicitud: ${registroUrl}`,
    "",
    `¿Dudas? Escríbenos a ${supportEmail()}.`,
  ].join("\n");

  return { subject: "Sobre tu solicitud de registro en Cercana", html, text };
}
