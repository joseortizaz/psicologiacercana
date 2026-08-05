"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type {
  CaseStatus,
  ClinicalHistorySections,
  ClinicalRecord,
  ClinicalSensitiveHistory,
} from "@/lib/types";

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

const HISTORY_SECTION_FIELDS: { key: keyof ClinicalHistorySections; label: string }[] = [
  { key: "personal_history", label: "Historia personal" },
  { key: "family_history", label: "Antecedentes familiares" },
  { key: "medical_history", label: "Antecedentes médicos" },
  { key: "psychiatric_history", label: "Antecedentes psicológicos/psiquiátricos" },
  { key: "social_history", label: "Historia social" },
  { key: "mental_status_exam", label: "Examen del estado mental" },
];

const SENSITIVE_SECTION_FIELDS: { key: keyof ClinicalSensitiveHistory; label: string }[] = [
  { key: "substance_use", label: "Consumo de sustancias" },
  { key: "trauma_history", label: "Historia de trauma o abuso" },
  { key: "risk_history", label: "Riesgo (ideación/intento suicida, autolesión)" },
  { key: "legal_history", label: "Historia legal (opcional)" },
];

const inputClass =
  "rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep";

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function sectionsToPayload<T extends Record<string, string>>(sections: T): T {
  return Object.fromEntries(
    Object.entries(sections).filter(([, v]) => v && v.trim().length > 0),
  ) as T;
}

function initSections<K extends string>(
  fields: { key: K }[],
  source: Partial<Record<K, string>> | undefined,
): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const f of fields) {
    out[f.key] = source?.[f.key] ?? "";
  }
  return out;
}

export function ClinicalRecordPanel({
  organizationId,
  clinicId,
  therapistId,
  patientId,
  record,
}: {
  organizationId: string;
  clinicId: string;
  therapistId: string;
  patientId: string;
  record: ClinicalRecord | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<CaseStatus>(record?.status ?? "active");
  const [chiefComplaint, setChiefComplaint] = useState(record?.chief_complaint ?? "");
  const [diagnosisHypothesis, setDiagnosisHypothesis] = useState(
    record?.diagnosis_hypothesis ?? "",
  );
  const [diagnosis, setDiagnosis] = useState(record?.diagnosis ?? "");
  const [therapeuticObjectives, setTherapeuticObjectives] = useState(
    record?.therapeutic_objectives ?? "",
  );
  const [treatmentPlan, setTreatmentPlan] = useState(record?.treatment_plan ?? "");
  const [medications, setMedications] = useState((record?.medications ?? []).join(", "));
  const [allergies, setAllergies] = useState((record?.allergies ?? []).join(", "));
  const [historySections, setHistorySections] = useState(() =>
    initSections(HISTORY_SECTION_FIELDS, record?.history_sections),
  );
  const [sensitiveHistory, setSensitiveHistory] = useState(() =>
    initSections(SENSITIVE_SECTION_FIELDS, record?.sensitive_history),
  );
  const [dischargeDate, setDischargeDate] = useState(
    record?.discharge_date ?? new Date().toISOString().slice(0, 10),
  );
  const [dischargeSummary, setDischargeSummary] = useState(record?.discharge_summary ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (status === "discharged" && (!dischargeDate || !dischargeSummary.trim())) {
      setError("Para dar de alta necesitas indicar la fecha y un resumen de alta.");
      return;
    }

    setLoading(true);

    const payload = {
      status,
      chief_complaint: chiefComplaint || null,
      diagnosis_hypothesis: diagnosisHypothesis || null,
      diagnosis: diagnosis || null,
      therapeutic_objectives: therapeuticObjectives || null,
      treatment_plan: treatmentPlan || null,
      medications: parseList(medications),
      allergies: parseList(allergies),
      history_sections: sectionsToPayload(historySections),
      sensitive_history: sectionsToPayload(sensitiveHistory),
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

  if (!record && !editing) {
    return (
      <div className="rounded-lg border border-line bg-white/60 p-6">
        <p className="text-sm text-ink/60">
          Este paciente todavía no tiene expediente clínico abierto contigo. Para agregar notas de
          sesión primero necesitas abrir uno.
        </p>
        <button
          onClick={() => setEditing(true)}
          className="mt-4 rounded-md bg-deep px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-deepLight"
        >
          Abrir expediente clínico
        </button>
      </div>
    );
  }

  if (!editing) {
    const presentHistory = HISTORY_SECTION_FIELDS.filter(
      (f) => record!.history_sections?.[f.key],
    );
    const presentSensitive = SENSITIVE_SECTION_FIELDS.filter(
      (f) => record!.sensitive_history?.[f.key],
    );

    return (
      <div className="flex flex-col gap-4">
        {record!.status === "discharged" && (
          <div className="rounded-lg border border-sage/40 bg-sage/10 p-6">
            <p className="font-display text-lg text-deep">
              Alta
              {record!.discharge_date &&
                ` · ${new Date(`${record!.discharge_date}T00:00:00`).toLocaleDateString("es-MX", { dateStyle: "long" })}`}
            </p>
            {record!.discharge_summary && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink/80">
                {record!.discharge_summary}
              </p>
            )}
          </div>
        )}

        <div className="rounded-lg border border-line bg-white/60 p-6">
          <div className="flex items-center justify-between">
            <p className="font-display text-lg text-deep">Expediente clínico</p>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-sage/15 px-2.5 py-1 text-xs font-medium text-sage">
                {STATUS_LABELS[record!.status]}
              </span>
              <button
                onClick={() => setEditing(true)}
                className="text-sm font-medium text-deep underline decoration-deep/30 underline-offset-2"
              >
                Editar
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 text-sm text-ink/70">
            <p>
              <span className="font-medium text-ink/80">Motivo de consulta: </span>
              {record!.chief_complaint ?? "—"}
            </p>
            <p>
              <span className="font-medium text-ink/80">Hipótesis diagnóstica: </span>
              {record!.diagnosis_hypothesis ?? "—"}
            </p>
            <p>
              <span className="font-medium text-ink/80">Diagnóstico: </span>
              {record!.diagnosis ?? "—"}
            </p>
            <p>
              <span className="font-medium text-ink/80">Objetivos terapéuticos: </span>
              {record!.therapeutic_objectives ?? "—"}
            </p>
            <p>
              <span className="font-medium text-ink/80">Plan de tratamiento: </span>
              {record!.treatment_plan ?? "—"}
            </p>
          </div>

          {(record!.medications?.length > 0 || record!.allergies?.length > 0) && (
            <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
              {record!.medications?.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-ink/40">Medicamentos</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {record!.medications.map((m) => (
                      <span
                        key={m}
                        className="rounded-full bg-ink/5 px-2.5 py-1 text-xs text-ink/70"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {record!.allergies?.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-ink/40">Alergias</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {record!.allergies.map((a) => (
                      <span
                        key={a}
                        className="rounded-full bg-clay/10 px-2.5 py-1 text-xs text-clay"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {presentHistory.length > 0 && (
          <div className="rounded-lg border border-line bg-white/60 p-6">
            <p className="font-display text-base text-deep">Historia clínica estructurada</p>
            <div className="mt-3 flex flex-col gap-3 text-sm text-ink/70">
              {presentHistory.map((f) => (
                <p key={f.key}>
                  <span className="font-medium text-ink/80">{f.label}: </span>
                  {record!.history_sections[f.key]}
                </p>
              ))}
            </div>
          </div>
        )}

        {presentSensitive.length > 0 && (
          <div className="rounded-lg border border-clay/30 bg-clay/5 p-6">
            <p className="font-display text-base text-deep">Información sensible</p>
            <div className="mt-3 flex flex-col gap-3 text-sm text-ink/70">
              {presentSensitive.map((f) => (
                <p key={f.key}>
                  <span className="font-medium text-ink/80">{f.label}: </span>
                  {record!.sensitive_history[f.key]}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-lg border border-line bg-white/60 p-6"
    >
      <p className="font-display text-lg text-deep">
        {record ? "Editar expediente clínico" : "Abrir expediente clínico"}
      </p>

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
            <textarea
              required
              value={dischargeSummary}
              onChange={(e) => setDischargeSummary(e.target.value)}
              rows={3}
              className={inputClass}
              placeholder="Motivo del alta, evolución, recomendaciones de seguimiento..."
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Motivo de consulta</label>
        <textarea
          value={chiefComplaint}
          onChange={(e) => setChiefComplaint(e.target.value)}
          rows={2}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Hipótesis diagnóstica</label>
        <textarea
          value={diagnosisHypothesis}
          onChange={(e) => setDiagnosisHypothesis(e.target.value)}
          rows={2}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Diagnóstico</label>
        <textarea
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          rows={2}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Objetivos terapéuticos</label>
        <textarea
          value={therapeuticObjectives}
          onChange={(e) => setTherapeuticObjectives(e.target.value)}
          rows={2}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Plan de tratamiento</label>
        <textarea
          value={treatmentPlan}
          onChange={(e) => setTreatmentPlan(e.target.value)}
          rows={3}
          className={inputClass}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink/80">
            Medicamentos (separados por coma)
          </label>
          <input
            value={medications}
            onChange={(e) => setMedications(e.target.value)}
            className={inputClass}
            placeholder="Sertralina 50mg, Clonazepam 0.5mg..."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink/80">
            Alergias (separadas por coma)
          </label>
          <input
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            className={inputClass}
            placeholder="Penicilina, ácido acetilsalicílico..."
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink/40">
          Historia clínica estructurada
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {HISTORY_SECTION_FIELDS.map((f) => (
            <div key={f.key} className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink/80">{f.label}</label>
              <textarea
                value={historySections[f.key]}
                onChange={(e) =>
                  setHistorySections((s) => ({ ...s, [f.key]: e.target.value }))
                }
                rows={2}
                className={inputClass}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-clay/30 bg-clay/5 p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-clay">
            Información sensible
          </p>
          <p className="mt-1 text-xs text-ink/50">
            Se muestra solo a ti y a supervisión clínica, igual que el resto del expediente.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {SENSITIVE_SECTION_FIELDS.map((f) => (
            <div key={f.key} className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink/80">{f.label}</label>
              <textarea
                value={sensitiveHistory[f.key]}
                onChange={(e) =>
                  setSensitiveHistory((s) => ({ ...s, [f.key]: e.target.value }))
                }
                rows={2}
                className={inputClass}
              />
            </div>
          ))}
        </div>
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
