// Utilidades de teléfono para el formulario de registro y el panel de
// solicitudes. La regla de validez debe coincidir con isValidPhone() en
// supabase/functions/submit-signup-request/index.ts (la edge function es la
// que manda; esto solo evita un viaje de red para un error evidente).

function compact(value: string): string {
  return value.trim().replace(/[\s\-().]/g, "").replace(/^\+/, "");
}

// Entre 10 y 15 dígitos (E.164). No se restringe a prefijos dominicanos
// (809/829/849) porque el solicitante puede tener un número de otro país.
export function isValidPhone(value: string): boolean {
  return /^\d{10,15}$/.test(compact(value));
}

// Enlace de WhatsApp (wa.me exige código de país, solo dígitos). Un número de
// 10 dígitos se asume del plan de numeración norteamericano (+1, que incluye
// a República Dominicana), que es lo habitual en esta app.
export function whatsappLink(value: string): string | null {
  const digits = compact(value);
  if (!/^\d{10,15}$/.test(digits)) return null;
  return `https://wa.me/${digits.length === 10 ? `1${digits}` : digits}`;
}
