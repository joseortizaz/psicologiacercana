import type { Consultation, FollowupNoteContent } from "@/lib/types";

// Nota de seguimiento psiquiátrico (formato de la psiquiatra). La fecha vive en
// consultations.session_date y el motivo de control en consultations.reason;
// el resto se guarda en consultations.note_content (jsonb). Paciente, edad y
// diagnósticos NO se piden: se leen de la ficha y de patient_diagnoses.
export const FOLLOWUP_FIELDS: {
  key: keyof FollowupNoteContent;
  label: string;
  rows: number;
  hint?: string;
}[] = [
  { key: "subjective_evolution", label: "Evolución subjetiva", rows: 3 },
  { key: "medication_adherence", label: "Adherencia y tolerancia farmacológica", rows: 3 },
  { key: "mental_status_exam", label: "Examen del estado mental (EEM)", rows: 4 },
  { key: "physical_exam", label: "Examen físico", rows: 2 },
  {
    key: "risk_assessment",
    label: "Evaluación de riesgo",
    rows: 3,
    hint: "Ideación suicida u homicida, autolesión, nivel de riesgo y plan de seguridad.",
  },
  { key: "management_plan", label: "Plan de manejo", rows: 4 },
];

export function hasFollowupNote(c: Pick<Consultation, "note_content">): boolean {
  const nc = c.note_content;
  return Boolean(nc && FOLLOWUP_FIELDS.some((f) => nc[f.key]));
}

/** Campos con contenido, en orden, para listas e impresión. */
export function followupEntries(
  c: Pick<Consultation, "note_content">,
): { key: keyof FollowupNoteContent; label: string; value: string }[] {
  const nc = c.note_content ?? {};
  return FOLLOWUP_FIELDS.filter((f) => nc[f.key]).map((f) => ({
    key: f.key,
    label: f.label,
    value: nc[f.key] as string,
  }));
}
