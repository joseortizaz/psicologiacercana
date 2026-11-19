import type {
  ClinicalHistorySections,
  ClinicalRecord,
  ClinicalSensitiveHistory,
  MedicationHistoryRow,
  SubstanceHabitKey,
  SubstanceHabitRow,
  TextKeys,
} from "@/lib/types";

type HistoryField = { key: TextKeys<ClinicalHistorySections>; label: string };
type SensitiveField = { key: TextKeys<ClinicalSensitiveHistory>; label: string };

// Todos los campos de texto de la historia, en el orden en que se leen/imprimen.
// Los de psicología y los de psiquiatría conviven: cada dato tiene UNA sola
// clave, y las vistas muestran solo las que tienen contenido.
export const ALL_HISTORY_FIELDS: HistoryField[] = [
  { key: "current_illness", label: "Historia de la enfermedad actual" },
  { key: "psychiatric_history", label: "Antecedentes psicológicos/psiquiátricos personales" },
  { key: "family_history", label: "Antecedentes psicológicos/psiquiátricos familiares" },
  { key: "medical_history", label: "Antecedentes médicos patológicos" },
  { key: "gyneco_obstetric", label: "Antecedentes gineco-obstétricos" },
  { key: "personal_history", label: "Historia personal" },
  { key: "life_curve", label: "Curva vital" },
  { key: "psychomotor_crawled", label: "Desarrollo psicomotor: gateó" },
  { key: "psychomotor_walked", label: "Desarrollo psicomotor: caminó" },
  { key: "psychomotor_first_words", label: "Desarrollo psicomotor: primeras palabras" },
  { key: "psychomotor_sphincter_control", label: "Desarrollo psicomotor: control de esfínteres" },
  { key: "childhood", label: "Niñez" },
  { key: "adolescence", label: "Adolescencia" },
  { key: "adulthood", label: "Adultez" },
  { key: "social_history", label: "Historia social" },
  { key: "family_perception", label: "Percepción familiar" },
  { key: "self_perception", label: "Autopercepción" },
  { key: "physical_exam", label: "Examen físico (datos positivos)" },
  { key: "mental_status_exam", label: "Examen del estado mental" },
  { key: "axis_iv_stressors", label: "Eje IV: estresores psicosociales" },
  { key: "axis_v_functioning", label: "Eje V: funcionamiento global" },
];

export const ALL_SENSITIVE_FIELDS: SensitiveField[] = [
  { key: "sexual_onset", label: "Inicio de vida sexual" },
  { key: "informal_relationships", label: "Relaciones informales" },
  { key: "formal_relationships", label: "Relaciones formales" },
  { key: "same_sex_relationships", label: "Relaciones homosexuales" },
  { key: "sti", label: "ETS" },
  { key: "trauma_history", label: "Abuso, violación o trauma" },
  { key: "substance_use", label: "Consumo de sustancias (observaciones)" },
  { key: "risk_history", label: "Riesgo (ideación/intento suicida, autolesión)" },
  { key: "legal_history", label: "Historia legal" },
];

export const SUBSTANCE_LABELS: Record<SubstanceHabitKey, string> = {
  coffee: "Café",
  tea: "Té / tisanas",
  tobacco: "Tabaco / cigarrillos",
  alcohol: "Alcohol",
  illegal_drugs: "Drogas ilegales",
};

export const SUBSTANCE_KEYS = Object.keys(SUBSTANCE_LABELS) as SubstanceHabitKey[];

export const MEDICATION_CATEGORY_LABELS: Record<MedicationHistoryRow["category"], string> = {
  psychiatric: "Antecedentes medicamentosos psiquiátricos",
  non_psychiatric: "Antecedentes medicamentosos no psiquiátricos",
};

export function emptyMedicationRow(category: MedicationHistoryRow["category"]): MedicationHistoryRow {
  return { category, name: "", dose_route: "", start: "", end: "", current: false, notes: "" };
}

export function defaultHabitRows(existing: SubstanceHabitRow[] | undefined): SubstanceHabitRow[] {
  return SUBSTANCE_KEYS.map(
    (substance) =>
      existing?.find((r) => r.substance === substance) ?? {
        substance,
        uses: false,
        duration: "",
        quit: "",
        notes: "",
      },
  );
}

/** Descarta filas vacías antes de guardar. */
export function cleanMedicationRows(rows: MedicationHistoryRow[]): MedicationHistoryRow[] {
  return rows.filter((r) => r.name.trim().length > 0);
}

/** Guarda solo los hábitos con algún dato (si no, la fila vuelve por defecto en "No"). */
export function cleanHabitRows(rows: SubstanceHabitRow[]): SubstanceHabitRow[] {
  return rows.filter((r) => r.uses || r.duration.trim() || r.quit.trim() || r.notes.trim());
}

export function medicationRows(
  history: ClinicalHistorySections | undefined,
  category: MedicationHistoryRow["category"],
): MedicationHistoryRow[] {
  return (history?.medication_history ?? []).filter((r) => r.category === category);
}

export function formatMedicationRow(r: MedicationHistoryRow): string {
  const parts = [r.name];
  if (r.dose_route) parts.push(r.dose_route);
  if (r.start || r.end) parts.push(`${r.start || "?"} → ${r.end || (r.current ? "actual" : "?")}`);
  if (r.current) parts.push("uso actual");
  if (r.notes) parts.push(r.notes);
  return parts.join(" · ");
}

export function formatHabitRow(r: SubstanceHabitRow): string {
  const parts = [r.uses ? "Sí" : "No"];
  if (r.duration) parts.push(`tiempo de consumo: ${r.duration}`);
  if (r.quit) parts.push(`abandono: ${r.quit}`);
  if (r.notes) parts.push(r.notes);
  return parts.join(" · ");
}

/** Líneas "etiqueta: texto" de las tablas estructuradas, para impresión/PDF. */
export function structuredHistoryLines(record: ClinicalRecord): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = [];
  for (const category of ["psychiatric", "non_psychiatric"] as const) {
    const rows = medicationRows(record.history_sections, category);
    if (rows.length > 0) {
      lines.push({
        label: MEDICATION_CATEGORY_LABELS[category],
        value: rows.map(formatMedicationRow).join("\n"),
      });
    }
  }
  const habits = record.sensitive_history?.substance_habits ?? [];
  if (habits.length > 0) {
    lines.push({
      label: "Hábitos tóxicos",
      value: habits.map((h) => `${SUBSTANCE_LABELS[h.substance]}: ${formatHabitRow(h)}`).join("\n"),
    });
  }
  return lines;
}
