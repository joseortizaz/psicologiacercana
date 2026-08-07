"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS } from "@/lib/roles";
import type { ClinicalRecordTeamMember, UserRole } from "@/lib/types";

const inputClass =
  "rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep";

export function TeamMembersPanel({
  clinicalRecordId,
  members,
  candidates,
}: {
  clinicalRecordId: string;
  /** Miembros activos actuales, con el profile del clínico ya unido. */
  members: ClinicalRecordTeamMember[];
  /** Personal de la clínica que todavía no es miembro activo, para el selector. */
  candidates: { id: string; full_name: string; role: UserRole }[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [selectedId, setSelectedId] = useState(candidates[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setLoading(true);
    setError(null);

    const { error: insertError } = await supabase.from("clinical_record_team_members").insert({
      clinical_record_id: clinicalRecordId,
      clinician_id: selectedId,
    });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.refresh();
  }

  async function handleRemove(memberId: string) {
    setRemovingId(memberId);
    setError(null);

    const { error: updateError } = await supabase
      .from("clinical_record_team_members")
      .update({ active: false })
      .eq("id", memberId);

    setRemovingId(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-white/60 p-6">
      <p className="font-display text-lg text-deep">Equipo de atención</p>

      {members.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-md border border-line bg-white px-4 py-2.5"
            >
              <div>
                <p className="text-sm font-medium text-ink">
                  {m.clinician?.full_name ?? "—"}
                </p>
                <p className="text-xs text-ink/50">
                  {m.clinician?.role ? ROLE_LABELS[m.clinician.role] : m.role_in_team}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(m.id)}
                disabled={removingId === m.id}
                className="text-sm font-medium text-clay hover:underline disabled:opacity-60"
              >
                {removingId === m.id ? "Quitando..." : "Quitar"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink/50">Sin miembros activos.</p>
      )}

      {candidates.length > 0 && (
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink/80">Agregar al equipo</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className={inputClass}
            >
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} · {ROLE_LABELS[c.role]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-deep px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-deepLight disabled:opacity-60"
          >
            {loading ? "Agregando..." : "Agregar"}
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm text-clay">
          {error}
        </p>
      )}
    </div>
  );
}
