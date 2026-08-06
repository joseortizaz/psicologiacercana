// Cuando una edge function responde con un status distinto de 2xx,
// supabase-js NO parsea el body JSON por nosotros: `error.message` queda
// como el genérico "Edge Function returned a non-2xx status code", aunque
// nuestras funciones sí devuelven { error: "mensaje útil" } en el body.
// Esta función lee ese body real (vía error.context, el Response crudo) y
// cae de vuelta al mensaje genérico solo si no puede parsearlo.
export async function extractFunctionErrorMessage(fnError: unknown): Promise<string> {
  if (fnError && typeof fnError === "object" && "context" in fnError) {
    const context = (fnError as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const body = await context.clone().json();
        if (body && typeof body.error === "string") {
          return body.error;
        }
      } catch {
        // El body no era JSON (o ya se leyó) — seguimos al mensaje genérico.
      }
    }
  }
  if (fnError && typeof fnError === "object" && "message" in fnError) {
    const message = (fnError as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Ocurrió un error inesperado.";
}
