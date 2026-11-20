"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FOLLOWUP_FIELDS } from "@/lib/followup-note";
import type { ConsultationModality, FollowupNoteContent } from "@/lib/types";
import { drDateToNoonIso, todayDR } from "@/lib/datetime";

const MODALITY_OPTIONS: { value: ConsultationModality; label: string }[] = [
  { value: "in_person", label: "Presencial" },
  { value: "virtual", label: "Virtual" },
  { value: "phone", label: "Telefónica" },
];

const inputClass =
  "rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep";

export function AddFollowupNoteForm({
  organizationId,
  clinicId,
  psychiatristId,
  patientId,
  clinicalRecordId,
  hasPrincipalDiagnosis = true,
}: {
  organizationId: string;
  clinicId: string;
  psychiatristId: string;
  patientId: string;
  clinicalRecordId: string;
  hasPrincipalDiagnosis?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [sessionDate, setSessionDate] = useState(() => todayDR());
  const [modality, setModality] = useState<ConsultationModality>("in_person");
  const [reason, setReason] = useState("");
  const [content, setContent] = useState<Record<keyof FollowupNoteContent, string>>({
    subjective_evolution: "",
    medication_adherence: "",
    mental_status_exam: "",
    physical_exam: "",
    risk_assessment: "",
    management_plan: "",
  });
  const [finalize, setFinalize] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!reason.trim()) {
      setError("Indica el motivo de control.");
      return;
    }
    if (finalize && !hasPrincipalDiagnosis) {
      setError("Para finalizar la nota registra primero el diagnóstico principal del paciente (sección Diagnósticos).");
      return;
    }
    // Una nota firmada sin evaluación de riesgo no se puede corregir después
    // sin dejar rastro, así que se exige al finalizar.
    if (finalize && !content.risk_assessment.trim()) {
      setError("Para finalizar la nota completa la evaluación de riesgo.");
      return;
    }

    setLoading(true);
    const now = new Date().toISOString();
    const note_content = Object.fromEntries(
      Object.entries(content)
        .map(([k, v]) => [k, v.trim()])
        .filter(([, v]) => v),
    );

    const { error: insertError } = await supabase.from("consultations").insert({
      organization_id: organizationId,
      clinic_id: clinicId,
      patient_id: patientId,
      clinical_record_id: clinicalRecordId,
      therapist_id: psychiatristId,
      session_date: drDateToNoonIso(sessionDate),
      modality,
      session_type: "individual",
      note_format: "free",
      reason: reason.trim(),
      note_content,
      status: finalize ? "finalized" : "draft",
      signed_at: finalize ? now : null,
      signed_by: finalize ? psychiatristId : null,
      created_by: psychiatristId,
    });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setReason("");
    setContent({
      subjective_evolution: "",
      medication_adherence: "",
      mental_status_exam: "",
      physical_exam: "",
      risk_assessment: "",
      management_plan: "",
    });
    setFinalize(false);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-line bg-white/60 p-6"
    >
      <div>
        <p className="font-display text-lg text-deep">Nota de seguimiento psiquiátrico</p>
        <p className="text-xs text-ink/50">
          El paciente, su edad y los diagnósticos se toman de la historia clínica.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink/80">Fecha</label>
          <input
            required
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink/80">Modalidad</label>
          <select
            value={modality}
            onChange={(e) => setModality(e.target.value as ConsultationModality)}
            className={inputClass}
          >
            {MODALITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Motivo de control</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
      </div>

      {FOLLOWUP_FIELDS.map((f) => (
        <div
          key={f.key}
          className={
            f.key === "risk_assessment"
              ? "flex flex-col gap-1.5 rounded-md border border-clay/30 bg-clay/5 p-3"
              : "flex flex-col gap-1.5"
          }
        >
          <label className="text-sm font-medium text-ink/80">{f.label}</label>
          {f.hint && <p className="text-xs text-ink/50">{f.hint}</p>}
          <textarea
            value={content[f.key]}
            onChange={(e) => setContent((s) => ({ ...s, [f.key]: e.target.value }))}
            rows={f.rows}
            className={inputClass}
          />
        </div>
      ))}

      <label className="flex items-center gap-2 text-sm text-ink/70">
        <input type="checkbox" checked={finalize} onChange={(e) => setFinalize(e.target.checked)} />
        Finalizar y firmar nota
      </label>

      {error && (
        <p role="alert" className="text-sm text-clay">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="self-start rounded-md bg-deep px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-deepLight disabled:opacity-60"
      >
        {loading ? "Guardando..." : "Guardar nota"}
      </button>
    </form>
  );
}
