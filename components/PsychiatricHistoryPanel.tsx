"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatAge } from "@/lib/age";
import { HistoryTables } from "@/components/HistoryTables";
import {
  ALL_HISTORY_FIELDS,
  ALL_SENSITIVE_FIELDS,
  MEDICATION_CATEGORY_LABELS,
  SUBSTANCE_LABELS,
  cleanHabitRows,
  cleanMedicationRows,
  defaultHabitRows,
  emptyMedicationRow,
} from "@/lib/psychiatric-history";
import type {
  CaseStatus,
  ClinicalHistorySections,
  ClinicalRecord,
  ClinicalSensitiveHistory,
  MedicationHistoryRow,
  SubstanceHabitRow,
  TextKeys,
} from "@/lib/types";

type HKey = TextKeys<ClinicalHistorySections>;
type SKey = TextKeys<ClinicalSensitiveHistory>;

const inputClass =
  "rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep";
const smallInput =
  "w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-deep";

const STATUS_OPTIONS: { value: CaseStatus; label: string }[] = [
  { value: "active", label: "Activo" },
  { value: "in_treatment", label: "En tratamiento" },
  { value: "suspended", label: "Suspendido" },
  { value: "discharged", label: "Dado de alta" },
];

const STATUS_LABELS: Record<CaseStatus, string> = {
  active: "Activo",
  in_treatment: "En tratamiento",
  suspended: "Suspendido",
  discharged: "Dado de alta",
};

// Campos de texto de la plantilla agrupados en el orden de la historia clínica.
// Los datos que ya viven en otro lugar (motivo, alergias, plan, diagnósticos CIE-11,
// fecha de nacimiento/edad) NO se piden aquí dos veces.
const TEXT_BLOCKS: { title: string; keys: HKey[]; rows: number }[] = [
  { title: "Enfermedad actual", keys: ["current_illness"], rows: 4 },
  {
    title: "Antecedentes",
    keys: ["psychiatric_history", "family_history", "medical_history"],
    rows: 3,
  },
  { title: "Curva vital y ciclo de vida", keys: ["life_curve", "childhood", "adolescence", "adulthood"], rows: 3 },
  { title: "Percepción", keys: ["family_perception", "self_perception"], rows: 3 },
  { title: "Examen", keys: ["physical_exam", "mental_status_exam"], rows: 4 },
  { title: "Impresión diagnóstica (ejes opcionales)", keys: ["axis_iv_stressors", "axis_v_functioning"], rows: 2 },
];

const PSYCHOMOTOR_KEYS: HKey[] = [
  "psychomotor_crawled",
  "psychomotor_walked",
  "psychomotor_first_words",
  "psychomotor_sphincter_control",
];
const PSYCHOSEXUAL_KEYS: SKey[] = [
  "sexual_onset",
  "informal_relationships",
  "formal_relationships",
  "same_sex_relationships",
  "sti",
];
const OTHER_HISTORY_KEYS: HKey[] = ["personal_history", "social_history"];
const OTHER_SENSITIVE_KEYS: SKey[] = ["trauma_history", "substance_use", "risk_history", "legal_history"];

const hLabel = (k: HKey) => ALL_HISTORY_FIELDS.find((f) => f.key === k)?.label ?? k;
const sLabel = (k: SKey) => ALL_SENSITIVE_FIELDS.find((f) => f.key === k)?.label ?? k;

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function PsychiatricHistoryPanel({
  organizationId,
  clinicId,
  therapistId,
  patientId,
  patientCategory,
  dateOfBirth,
  record,
}: {
  organizationId: string;
  clinicId: string;
  therapistId: string;
  patientId: string;
  patientCategory: string;
  dateOfBirth: string;
  record: ClinicalRecord | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hs = record?.history_sections ?? {};
  const ss = record?.sensitive_history ?? {};

  const [status, setStatus] = useState<CaseStatus>(record?.status ?? "active");
  const [chiefComplaint, setChiefComplaint] = useState(record?.chief_complaint ?? "");
  const [treatmentPlan, setTreatmentPlan] = useState(record?.treatment_plan ?? "");
  const [allergies, setAllergies] = useState((record?.allergies ?? []).join(", "));
  const [dischargeDate, setDischargeDate] = useState(
    record?.discharge_date ?? new Date().toISOString().slice(0, 10),
  );
  const [dischargeSummary, setDischargeSummary] = useState(record?.discharge_summary ?? "");

  const allHKeys: HKey[] = [
    ...TEXT_BLOCKS.flatMap((b) => b.keys),
    ...PSYCHOMOTOR_KEYS,
    ...OTHER_HISTORY_KEYS,
    "gyneco_obstetric",
  ];
  const allSKeys: SKey[] = [...PSYCHOSEXUAL_KEYS, ...OTHER_SENSITIVE_KEYS];

  const [hText, setHText] = useState<Record<string, string>>(() =>
    Object.fromEntries(allHKeys.map((k) => [k, hs[k] ?? ""])),
  );
  const [sText, setSText] = useState<Record<string, string>>(() =>
    Object.fromEntries(allSKeys.map((k) => [k, ss[k] ?? ""])),
  );
  const [meds, setMeds] = useState<MedicationHistoryRow[]>(hs.medication_history ?? []);
  const [habits, setHabits] = useState<SubstanceHabitRow[]>(() =>
    defaultHabitRows(ss.substance_habits),
  );

  // Secciones opcionales: se muestran si ya tienen datos o si la persona las abre.
  const [showPsychomotor, setShowPsychomotor] = useState(
    patientCategory !== "adult" || PSYCHOMOTOR_KEYS.some((k) => Boolean(hs[k])),
  );
  const [showGyneco, setShowGyneco] = useState(Boolean(hs.gyneco_obstetric));

  function updateMed(index: number, patch: Partial<MedicationHistoryRow>) {
    setMeds((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function updateHabit(substance: SubstanceHabitRow["substance"], patch: Partial<SubstanceHabitRow>) {
    setHabits((rows) => rows.map((r) => (r.substance === substance ? { ...r, ...patch } : r)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (status === "discharged" && (!dischargeDate || !dischargeSummary.trim())) {
      setError("Para dar de alta necesitas indicar la fecha y un resumen de alta.");
      return;
    }

    setLoading(true);

    // Parte de lo ya guardado para no borrar claves que este formulario no edita.
    const nextHistory: Record<string, unknown> = { ...hs };
    for (const k of allHKeys) {
      const v = (hText[k] ?? "").trim();
      if (v && (showPsychomotor || !PSYCHOMOTOR_KEYS.includes(k)) && (showGyneco || k !== "gyneco_obstetric")) {
        nextHistory[k] = v;
      } else {
        delete nextHistory[k];
      }
    }
    const medRows = cleanMedicationRows(meds);
    if (medRows.length > 0) nextHistory.medication_history = medRows;
    else delete nextHistory.medication_history;

    const nextSensitive: Record<string, unknown> = { ...ss };
    for (const k of allSKeys) {
      const v = (sText[k] ?? "").trim();
      if (v) nextSensitive[k] = v;
      else delete nextSensitive[k];
    }
    const habitRows = cleanHabitRows(habits);
    if (habitRows.length > 0) nextSensitive.substance_habits = habitRows;
    else delete nextSensitive.substance_habits;

    const payload = {
      status,
      chief_complaint: chiefComplaint || null,
      treatment_plan: treatmentPlan || null,
      allergies: parseList(allergies),
      history_sections: nextHistory,
      sensitive_history: nextSensitive,
      discharge_date: status === "discharged" ? dischargeDate : null,
      discharge_summary: status === "discharged" ? dischargeSummary || null : null,
    };

    const { error: dbError } = record
      ? await supabase.from("clinical_records").update(payload).eq("id", record.id)
      : await supabase.from("clinical_records").insert({
          ...payload,
          organization_id: organizationId,
          clinic_id: clinicId,
          patient_id: patientId,
          primary_therapist_id: therapistId,
          created_by: therapistId,
        });

    setLoading(false);

    if (dbError) {
      setError(dbError.message);
      return;
    }

    setEditing(false);
    router.refresh();
  }

  // ------------------------------------------------------------------ lectura
  if (!editing) {
    if (!record) {
      return (
        <div className="rounded-lg border border-line bg-white/60 p-6">
          <p className="text-sm text-ink/60">
            Este paciente todavía no tiene historia clínica. Edad actual: {formatAge(dateOfBirth)}.
          </p>
          <button
            onClick={() => setEditing(true)}
            className="mt-4 rounded-md bg-deep px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-deepLight"
          >
            Iniciar historia clínica
          </button>
        </div>
      );
    }

    const presentHistory = ALL_HISTORY_FIELDS.filter((f) => record.history_sections?.[f.key]);
    const presentSensitive = ALL_SENSITIVE_FIELDS.filter((f) => record.sensitive_history?.[f.key]);

    return (
      <div className="flex flex-col gap-4">
        {record.status === "discharged" && (
          <div className="rounded-lg border border-sage/40 bg-sage/10 p-6">
            <p className="font-display text-lg text-deep">
              Alta
              {record.discharge_date &&
                ` · ${new Date(`${record.discharge_date}T00:00:00`).toLocaleDateString("es-MX", { dateStyle: "long" })}`}
            </p>
            {record.discharge_summary && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink/80">{record.discharge_summary}</p>
            )}
          </div>
        )}

        <div className="rounded-lg border border-line bg-white/60 p-6">
          <div className="flex items-center justify-between">
            <p className="font-display text-lg text-deep">Historia clínica</p>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-sage/15 px-2.5 py-1 text-xs font-medium text-sage">
                {STATUS_LABELS[record.status]}
              </span>
              <button
                onClick={() => setEditing(true)}
                className="text-sm font-medium text-deep underline decoration-deep/30 underline-offset-2"
              >
                Editar
              </button>
            </div>
          </div>
          <p className="mt-1 text-xs text-ink/50">
            Abierta el{" "}
            {new Date(record.created_at).toLocaleString("es-MX", {
              dateStyle: "long",
              timeStyle: "short",
            })}{" "}
            · Edad actual del paciente: {formatAge(dateOfBirth)}
          </p>

          <div className="mt-4 flex flex-col gap-3 text-sm text-ink/70">
            <p>
              <span className="font-medium text-ink/80">Motivo de consulta: </span>
              {record.chief_complaint ?? "—"}
            </p>
            <p>
              <span className="font-medium text-ink/80">Consideraciones y plan terapéutico: </span>
              <span className="whitespace-pre-wrap">{record.treatment_plan ?? "—"}</span>
            </p>
            {record.medications?.length > 0 && (
              <p>
                <span className="font-medium text-ink/80">Medicamentos (registro anterior): </span>
                {record.medications.join(", ")}
              </p>
            )}
          </div>

          {record.allergies?.length > 0 && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-xs uppercase tracking-wide text-ink/40">Alergias</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {record.allergies.map((a) => (
                  <span key={a} className="rounded-full bg-clay/10 px-2.5 py-1 text-xs text-clay">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {presentHistory.length > 0 && (
          <div className="rounded-lg border border-line bg-white/60 p-6">
            <div className="flex flex-col gap-3 text-sm text-ink/70">
              {presentHistory.map((f) => (
                <p key={f.key}>
                  <span className="font-medium text-ink/80">{f.label}: </span>
                  <span className="whitespace-pre-wrap">{record.history_sections[f.key]}</span>
                </p>
              ))}
            </div>
          </div>
        )}

        <HistoryTables record={record} />

        {presentSensitive.length > 0 && (
          <div className="rounded-lg border border-clay/30 bg-clay/5 p-6">
            <p className="font-display text-base text-deep">Información sensible</p>
            <div className="mt-3 flex flex-col gap-3 text-sm text-ink/70">
              {presentSensitive.map((f) => (
                <p key={f.key}>
                  <span className="font-medium text-ink/80">{f.label}: </span>
                  <span className="whitespace-pre-wrap">{record.sensitive_history[f.key]}</span>
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------- edición
  const textArea = (value: string, onChange: (v: string) => void, rows: number) => (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className={inputClass} />
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 rounded-lg border border-line bg-white/60 p-6"
    >
      <div>
        <p className="font-display text-lg text-deep">
          {record ? "Editar historia clínica" : "Historia clínica psiquiátrica"}
        </p>
        <p className="mt-1 text-xs text-ink/50">
          Edad del paciente: {formatAge(dateOfBirth)} (se calcula de la fecha de nacimiento). Los
          diagnósticos CIE-11 y las recetas se registran en sus secciones más abajo.
        </p>
      </div>

      {record && (
        <div className="flex flex-col gap-1.5 sm:w-1/2">
          <label className="text-sm font-medium text-ink/80">Estado del caso</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as CaseStatus)}
            className={inputClass}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {record && status === "discharged" && (
        <div className="grid gap-4 rounded-md border border-sage/40 bg-sage/10 p-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink/80">Fecha de alta</label>
            <input
              required
              type="date"
              value={dischargeDate}
              onChange={(e) => setDischargeDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-sm font-medium text-ink/80">Resumen de alta</label>
            {textArea(dischargeSummary, setDischargeSummary, 3)}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Motivos de consulta</label>
        {textArea(chiefComplaint, setChiefComplaint, 2)}
      </div>

      {TEXT_BLOCKS.slice(0, 2).map((block) => (
        <div key={block.title} className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink/40">{block.title}</p>
          {block.keys.map((k) => (
            <div key={k} className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink/80">{hLabel(k)}</label>
              {textArea(hText[k], (v) => setHText((s) => ({ ...s, [k]: v })), block.rows)}
            </div>
          ))}
        </div>
      ))}

      {(["psychiatric", "non_psychiatric"] as const).map((category) => {
        const indexed = meds.map((m, i) => ({ m, i })).filter(({ m }) => m.category === category);
        return (
          <div key={category} className="flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-ink/40">
              {MEDICATION_CATEGORY_LABELS[category]}
            </p>
            {indexed.map(({ m, i }) => (
              <div key={i} className="grid gap-2 rounded-md border border-line bg-white p-3 sm:grid-cols-6">
                <input
                  placeholder="Medicamento"
                  value={m.name}
                  onChange={(e) => updateMed(i, { name: e.target.value })}
                  className={`${smallInput} sm:col-span-2`}
                />
                <input
                  placeholder="Dosis / vía"
                  value={m.dose_route}
                  onChange={(e) => updateMed(i, { dose_route: e.target.value })}
                  className={smallInput}
                />
                <input
                  placeholder="Inicio"
                  value={m.start}
                  onChange={(e) => updateMed(i, { start: e.target.value })}
                  className={smallInput}
                />
                <input
                  placeholder="Finalización"
                  value={m.end}
                  onChange={(e) => updateMed(i, { end: e.target.value })}
                  className={smallInput}
                />
                <label className="flex items-center gap-2 text-sm text-ink/70">
                  <input
                    type="checkbox"
                    checked={m.current}
                    onChange={(e) => updateMed(i, { current: e.target.checked })}
                  />
                  Uso actual
                </label>
                <input
                  placeholder="Observaciones"
                  value={m.notes}
                  onChange={(e) => updateMed(i, { notes: e.target.value })}
                  className={`${smallInput} sm:col-span-5`}
                />
                <button
                  type="button"
                  onClick={() => setMeds((rows) => rows.filter((_, idx) => idx !== i))}
                  className="text-left text-sm text-clay sm:text-right"
                >
                  Quitar
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setMeds((rows) => [...rows, emptyMedicationRow(category)])}
              className="self-start text-sm font-medium text-deep underline decoration-deep/30 underline-offset-2"
            >
              + Agregar medicamento
            </button>
          </div>
        );
      })}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Alergias (separadas por coma)</label>
        <input
          value={allergies}
          onChange={(e) => setAllergies(e.target.value)}
          className={inputClass}
          placeholder="Penicilina, ácido acetilsalicílico..."
        />
      </div>

      <div className="flex flex-col gap-3">
        {showGyneco ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink/80">{hLabel("gyneco_obstetric")}</label>
            {textArea(hText.gyneco_obstetric, (v) => setHText((s) => ({ ...s, gyneco_obstetric: v })), 3)}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowGyneco(true)}
            className="self-start text-sm font-medium text-deep underline decoration-deep/30 underline-offset-2"
          >
            + Antecedentes gineco-obstétricos
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-clay/30 bg-clay/5 p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-clay">
            Esfera psicosexual y hábitos (información sensible)
          </p>
          <p className="mt-1 text-xs text-ink/50">
            Se muestra solo a tu equipo de atención y a supervisión clínica, igual que el resto del
            expediente.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {PSYCHOSEXUAL_KEYS.map((k) => (
            <div key={k} className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink/80">{sLabel(k)}</label>
              <input
                value={sText[k]}
                onChange={(e) => setSText((s) => ({ ...s, [k]: e.target.value }))}
                className={inputClass}
              />
            </div>
          ))}
        </div>

        <p className="mt-2 text-sm font-medium text-ink/80">Hábitos tóxicos</p>
        <div className="flex flex-col gap-2">
          {habits.map((h) => (
            <div key={h.substance} className="grid gap-2 rounded-md border border-line bg-white p-3 sm:grid-cols-5">
              <label className="flex items-center gap-2 text-sm text-ink/80 sm:col-span-1">
                <input
                  type="checkbox"
                  checked={h.uses}
                  onChange={(e) => updateHabit(h.substance, { uses: e.target.checked })}
                />
                {SUBSTANCE_LABELS[h.substance]}
              </label>
              <input
                placeholder="Tiempo de consumo"
                value={h.duration}
                onChange={(e) => updateHabit(h.substance, { duration: e.target.value })}
                className={smallInput}
              />
              <input
                placeholder="Abandono"
                value={h.quit}
                onChange={(e) => updateHabit(h.substance, { quit: e.target.value })}
                className={smallInput}
              />
              <input
                placeholder="Observaciones"
                value={h.notes}
                onChange={(e) => updateHabit(h.substance, { notes: e.target.value })}
                className={`${smallInput} sm:col-span-2`}
              />
            </div>
          ))}
        </div>

        {OTHER_SENSITIVE_KEYS.map((k) => (
          <div key={k} className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink/80">{sLabel(k)}</label>
            {textArea(sText[k], (v) => setSText((s) => ({ ...s, [k]: v })), 2)}
          </div>
        ))}
      </div>

      {TEXT_BLOCKS.slice(2, 3).map((block) => (
        <div key={block.title} className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink/40">{block.title}</p>
          {showPsychomotor ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {PSYCHOMOTOR_KEYS.map((k) => (
                <div key={k} className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-ink/80">
                    {hLabel(k).replace("Desarrollo psicomotor: ", "Desarrollo psicomotor · ")}
                  </label>
                  <input
                    value={hText[k]}
                    onChange={(e) => setHText((s) => ({ ...s, [k]: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowPsychomotor(true)}
              className="self-start text-sm font-medium text-deep underline decoration-deep/30 underline-offset-2"
            >
              + Desarrollo psicomotor
            </button>
          )}
          {block.keys.map((k) => (
            <div key={k} className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink/80">{hLabel(k)}</label>
              {textArea(hText[k], (v) => setHText((s) => ({ ...s, [k]: v })), block.rows)}
            </div>
          ))}
          {OTHER_HISTORY_KEYS.map((k) => (
            <div key={k} className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink/80">{hLabel(k)}</label>
              {textArea(hText[k], (v) => setHText((s) => ({ ...s, [k]: v })), 2)}
            </div>
          ))}
        </div>
      ))}

      {TEXT_BLOCKS.slice(3).map((block) => (
        <div key={block.title} className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink/40">{block.title}</p>
          {block.keys.map((k) => (
            <div key={k} className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink/80">{hLabel(k)}</label>
              {textArea(hText[k], (v) => setHText((s) => ({ ...s, [k]: v })), block.rows)}
            </div>
          ))}
        </div>
      ))}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Consideraciones y plan terapéutico</label>
        {textArea(treatmentPlan, setTreatmentPlan, 4)}
      </div>

      {error && (
        <p role="alert" className="text-sm text-clay">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-deep px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-deepLight disabled:opacity-60"
        >
          {loading ? "Guardando..." : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-md px-4 py-2.5 text-sm font-medium text-ink/60 transition hover:text-ink"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
