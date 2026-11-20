"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Asignación rápida desde las listas de pacientes (secretaria o administrador):
// un solo selector, sin abrir la ficha. Solo se muestra en pacientes sin asignar.
export function AssignProfessionalSelect({
  patientId,
  options,
}: {
  patientId: string;
  options: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function assign(professionalId: string) {
    if (!professionalId) return;
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("patients")
      .update({ primary_therapist_id: professionalId })
      .eq("id", patientId);
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
  }

  if (options.length === 0) return <span className="text-ink/50">Sin asignar</span>;

  return (
    <div className="flex flex-col gap-1">
      <select
        defaultValue=""
        disabled={busy}
        onChange={(e) => assign(e.target.value)}
        aria-label="Asignar profesional"
        className="rounded-md border border-clay/40 bg-clay/5 px-2 py-1 text-sm text-clay outline-none focus:border-deep disabled:opacity-60"
      >
        <option value="">Asignar a…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.full_name}
          </option>
        ))}
      </select>
      {error && (
        <span role="alert" className="text-xs text-clay">
          {error}
        </span>
      )}
    </div>
  );
}
