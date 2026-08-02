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

export function ScheduleAppointmentForm({
  organizationId,
  clinicId,
  therapistId,
  patientId,
}: {
  organizationId: string;
  clinicId: string;
  therapistId: string;
  patientId: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState("50");
  const [modality, setModality] = useState<ConsultationModality>("in_person");
  const [sessionType, setSessionType] = useState<ConsultationSessionType>("individual");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const start = new Date(startTime);
    const end = new Date(start.getTime() + (Number(duration) || 50) * 60000);

    const { error: insertError } = await supabase.from("appointments").insert({
      organization_id: organizationId,
      clinic_id: clinicId,
      therapist_id: therapistId,
      patient_id: patientId,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      modality,
      session_type: sessionType,
      reason: reason || null,
    });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setOpen(false);
    setStartTime("");
    setDuration("50");
    setReason("");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-deep px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-deepLight"
      >
        Agendar cita
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-line bg-white/60 p-6"
    >
      <p className="font-display text-lg text-deep">Agendar cita</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink/80">Fecha y hora</label>
          <input
            required
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink/80">Duración (min)</label>
          <input
            required
            type="number"
            min={5}
            step={5}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink/80">Modalidad</label>
          <select
            value={modality}
            onChange={(e) => setModality(e.target.value as ConsultationModality)}
            className="rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep"
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
            className="rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep"
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
        <label className="text-sm font-medium text-ink/80">Motivo (opcional)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          className="rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep"
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
          {loading ? "Agendando..." : "Confirmar cita"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-4 py-2.5 text-sm font-medium text-ink/60 transition hover:text-ink"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
