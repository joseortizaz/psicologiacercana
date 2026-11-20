// Toda la plataforma trabaja en hora de República Dominicana (UTC-4, sin horario
// de verano), sin importar dónde corra el código: el servidor de Vercel está en
// UTC y el navegador puede tener otra zona. Si cada pantalla usara la zona de
// donde se ejecuta, la misma cita se vería con horas distintas (p. ej. 11:49 a.
// m. al agendar y 3:49 p. m. en la lista).
export const TIME_ZONE = "America/Santo_Domingo";
const DR_OFFSET = "-04:00";

/** Fecha de hoy en RD ("YYYY-MM-DD"). No usar toISOString(): pasadas las 8 p. m. ya es mañana en UTC. */
export function todayDR(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** "YYYY-MM-DDTHH:mm" (hora de RD, de un <input type="datetime-local">) → ISO UTC. */
export function drLocalToIso(local: string): string {
  const value = local.trim().replace(" ", "T");
  const withSeconds = /T\d{2}:\d{2}$/.test(value) ? `${value}:00` : value;
  return new Date(`${withSeconds}${DR_OFFSET}`).toISOString();
}

/** ISO de la base de datos → valor para <input type="datetime-local"> en hora de RD. */
export function isoToDrLocalInput(iso: string | null): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** "YYYY-MM-DD" elegido en un <input type="date"> → ISO a mediodía de RD (se ve el mismo día en cualquier zona). */
export function drDateToNoonIso(date: string): string {
  return new Date(`${date}T12:00:00${DR_OFFSET}`).toISOString();
}
