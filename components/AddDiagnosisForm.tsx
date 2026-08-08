"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { DiagnosisCode, DiagnosisType } from "@/lib/types";

const TYPE_OPTIONS: { value: DiagnosisType; label: string }[] = [
  { value: "principal", label: "Principal" },
  { value: "secundario", label: "Secundario" },
];

const inputClass =
  "rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep";

export function AddDiagnosisForm({
  clinicId,
  patientId,
  clinicalRecordId,
  diagnosedBy,
}: {
  clinicId: string;
  patientId: string;
  clinicalRecordId: string;
  diagnosedBy: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DiagnosisCode[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<DiagnosisCode | null>(null);
  const [type, setType] = useState<DiagnosisType>("principal");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(term: string) {
    setQuery(term);
    setSelected(null);

    if (term.trim().length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);
    const { data, error: searchError } = await supabase
      .from("diagnosis_codes")
      .select("id, system, code, title, parent_code, active")
      .eq("active", true)
      .ilike("title", `%${term.trim()}%`)
      .order("title", { ascending: true })
      .limit(10)
      .returns<DiagnosisCode[]>();

    setSearching(false);

    if (!searchError) {
      setResults(data ?? []);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    setError(null);

    const { error: insertError } = await supabase.from("patient_diagnoses").insert({
      clinic_id: clinicId,
      patient_id: patientId,
      clinical_record_id: clinicalRecordId,
      diagnosis_code_id: selected.id,
      diagnosed_by: diagnosedBy,
      type,
      notes: notes || null,
    });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setQuery("");
    setResults([]);
    setSelected(null);
    setNotes("");
    setType("principal");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-line bg-white/60 p-6"
    >
      <p className="font-display text-lg text-deep">Registrar diagnóstico</p>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Buscar en el catálogo CIE-11</label>
        <input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Escribe al menos 2 letras (ej. depresión, ansiedad)..."
          className={inputClass}
        />
        {searching && <p className="text-xs text-ink/40">Buscando...</p>}

        {!searching && query.trim().length >= 2 && results.length === 0 && (
          <p className="text-xs text-ink/40">
            Sin resultados. El catálogo CIE-11 podría no estar sincronizado todavía.
          </p>
        )}

        {results.length > 0 && !selected && (
          <ul className="mt-1 flex max-h-56 flex-col gap-1 overflow-y-auto rounded-md border border-line bg-white p-1">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(r);
                    setQuery(`${r.code} · ${r.title}`);
                    setResults([]);
                  }}
                  className="w-full rounded px-2.5 py-1.5 text-left text-sm text-ink/80 hover:bg-paperMuted"
                >
                  <span className="font-medium">{r.code}</span> · {r.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Tipo</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as DiagnosisType)}
          className={inputClass}
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Notas (opcional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className={inputClass}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-clay">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !selected}
        className="self-start rounded-md bg-deep px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-deepLight disabled:opacity-60"
      >
        {loading ? "Guardando..." : "Guardar diagnóstico"}
      </button>
    </form>
  );
}
