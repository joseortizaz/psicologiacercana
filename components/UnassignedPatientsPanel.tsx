"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Pacientes de la clínica que aún no tienen profesional (por ejemplo, los que
// registró la secretaria). El profesional se los asigna con un clic.
export function UnassignedPatientsPanel({
  professionalId,
  patients,
}: {
  professionalId: string;
  patients: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (patients.length === 0) return null;

  async function claim(patientId: string) {
    setBusyId(patientId);
    setError(null);
    const { error: updateError } = await supabase
      .from("patients")
      .update({ primary_therapist_id: professionalId })
      .eq("id", patientId);
    setBusyId(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-clay/30 bg-clay/5 p-5">
      <p className="font-display text-lg text-deep">Pacientes sin asignar de tu clínica</p>
      <p className="mt-1 text-xs text-ink/60">
        Fueron registrados sin un profesional. Asígnatelos para verlos en tu lista y agendarles
        citas.
      </p>
      <ul className="mt-3 flex flex-col divide-y divide-line">
        {patients.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="font-medium text-ink">{p.full_name}</span>
            <button
              type="button"
              onClick={() => claim(p.id)}
              disabled={busyId === p.id}
              className="rounded-md border border-deep px-3 py-1 text-sm font-medium text-deep transition hover:bg-deep hover:text-paper disabled:opacity-60"
            >
              {busyId === p.id ? "Asignando..." : "Asignarme"}
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-2 text-xs text-clay">
          {error}
        </p>
      )}
    </section>
  );
}
