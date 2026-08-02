"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { CaseStatus, ClinicalRecord } from "@/lib/types";

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

const inputClass =
  "rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep";

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      status,
      chief_complaint: chiefComplaint || null,
      diagnosis_hypothesis: diagnosisHypothesis || null,
      diagnosis: diagnosis || null,
      therapeutic_objectives: therapeuticObjectives || null,
      treatment_plan: treatmentPlan || null,
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
    return (
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
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-line bg-white/60 p-6"
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
