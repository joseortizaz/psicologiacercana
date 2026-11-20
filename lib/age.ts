import { todayDR } from "@/lib/datetime";

// La edad nunca se guarda: se calcula siempre a partir de la fecha de
// nacimiento ("YYYY-MM-DD", columna `date` de Postgres) para que no se desfase.

function parseDateOnly(dateStr: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/** Años y meses cumplidos a la fecha `today`. Null si la fecha no es válida o es futura. */
export function calculateAge(
  dateOfBirth: string,
  today: Date = new Date(),
): { years: number; months: number } | null {
  const dob = parseDateOnly(dateOfBirth);
  if (!dob) return null;

  // "Hoy" en hora de RD: pasadas las 8 p. m. el servidor (UTC) ya está en el día siguiente.
  const now = parseDateOnly(todayDR(today))!;
  let months = (now.y - dob.y) * 12 + (now.m - dob.m);
  if (now.d < dob.d) months -= 1;
  if (months < 0) return null;

  return { years: Math.floor(months / 12), months: months % 12 };
}

/** "34 años", "1 año", "8 meses", "3 años y 4 meses" (con meses solo en menores de 5). */
export function formatAge(dateOfBirth: string, today: Date = new Date()): string {
  const age = calculateAge(dateOfBirth, today);
  if (!age) return "—";

  const { years, months } = age;
  const yearsLabel = `${years} ${years === 1 ? "año" : "años"}`;
  if (years === 0) return `${months} ${months === 1 ? "mes" : "meses"}`;
  if (years < 5 && months > 0) return `${yearsLabel} y ${months} ${months === 1 ? "mes" : "meses"}`;
  return yearsLabel;
}
