"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function CreateClinicForm({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: insertError } = await supabase
      .from("clinics")
      .insert({ organization_id: organizationId, name });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setOpen(false);
    setName("");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-deep underline decoration-deep/30 underline-offset-2 transition hover:decoration-deep"
      >
        + Agregar sucursal
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Nombre de la sucursal</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-line bg-white px-3.5 py-2 outline-none focus:border-deep"
          placeholder="Sede Norte"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-deep px-4 py-2 text-sm font-medium text-paper transition hover:bg-deepLight disabled:opacity-60"
      >
        {loading ? "Creando..." : "Crear"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-sm font-medium text-ink/60 transition hover:text-ink"
      >
        Cancelar
      </button>
      {error && <p className="text-sm text-clay">{error}</p>}
    </form>
  );
}
