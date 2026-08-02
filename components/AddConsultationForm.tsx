"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ConsultationModality, ConsultationSessionType } from "@/lib/types";

const MODALITY_OPTIONS: { value: ConsultationModality; label: string }[] = [
  { value: "in_person", label: "Presencial" },
  { value: "virtual", label: "Virtual" },
  { value: "phone", label: "Telefónica" },
];

const SESSION_TYPE_OPTIONS: { value: ConsultationSessionType; label: string }[] = [
  { value: "individual", label: "Individual" },
  { value: "family", label: "Familiar" },
  { value: "couple", label: "Pareja" },
  { value: "group", label: "Grupal" },
];

const inputClass =
  "rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep";

export function AddConsultationForm({
  organizationId,
  clinicId,
  therapistId,
  patientId,
  clinicalRecordId,
}: {
  organizationId: string;
  clinicId: string;
  therapistId: string;
  patientId: string;
  clinicalRecordId: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState("50");
  const [modality, setModality] = useState<ConsultationModality>("in_person");
  const [sessionType, setSessionType] = useState<ConsultationSessionType>("individual");
  const [reason, setReason] = useState("");
  const [objectives, setObjectives] = useState("");
  const [interventions, setInterventions] = useState("");
  const [observations, setObservations] = useState("");
  const [homeworkTasks, setHomeworkTasks] = useState("");
  const [techniques, setTechniques] = useState("");
  const [finalize, setFinalize] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const now = new Date().toISOString();

    const { error: insertError } = await supabase.from("consultations").insert({
      organization_id: organizationId,
      clinic_id: clinicId,
      patient_id: patientId,
      clinical_record_id: clinicalRecordId,
      therapist_id: therapistId,
      // session_date es timestamptz; interpretamos el <input type="date">
      // como medianoche en la hora local del navegador antes de convertir a
      // UTC, para que no se corra un día al mostrarla en zonas detrás de UTC.
      session_date: new Date(`${sessionDate}T00:00:00`).toISOString(),
      duration_minutes: Number(duration) || null,
      modality,
      session_type: sessionType,
      note_format: "free",
      reason: reason || null,
      objectives: objectives || null,
      interventions: interventions || null,
      observations: observations || null,
      homework_tasks: homeworkTasks || null,
      techniques_used: techniques
        ? techniques.split(",").map((t) => t.trim()).filter(Boolean)
        : [],
      status: finalize ? "finalized" : "draft",
      signed_at: finalize ? now : null,
      signed_by: finalize ? therapistId : null,
      created_by: therapistId,
    });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setReason("");
    setObjectives("");
    setInterventions("");
    setObservations("");
    setHomeworkTasks("");
    setTechniques("");
    setFinalize(false);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-line bg-white/60 p-6"
    >
      <p className="font-display text-lg text-deep">Nueva nota de sesión</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink/80">Fecha de sesión</label>
          <input
            required
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink/80">Duración (min)</label>
          <input
            type="number"
            min={5}
            step={5}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
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
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink/80">Tipo de sesión</label>
          <select
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value as ConsultationSessionType)}
            className={inputClass}
          >
            {SESSION_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Motivo de la sesión</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Objetivos</label>
        <textarea
          value={objectives}
          onChange={(e) => setObjectives(e.target.value)}
          rows={2}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Intervenciones</label>
        <textarea
          value={interventions}
          onChange={(e) => setInterventions(e.target.value)}
          rows={2}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Técnicas utilizadas (separadas por coma)</label>
        <input
          value={techniques}
          onChange={(e) => setTechniques(e.target.value)}
          className={inputClass}
          placeholder="reestructuración cognitiva, respiración diafragmática..."
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Observaciones</label>
        <textarea
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          rows={3}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Tareas para casa</label>
        <textarea
          value={homeworkTasks}
          onChange={(e) => setHomeworkTasks(e.target.value)}
          rows={2}
          className={inputClass}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-ink/70">
        <input
          type="checkbox"
          checked={finalize}
          onChange={(e) => setFinalize(e.target.checked)}
        />
        Finalizar y firmar esta nota (ya no se podrá editar)
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
