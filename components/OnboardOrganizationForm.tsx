"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function OnboardOrganizationForm() {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [organizationName, setOrganizationName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminFullName, setAdminFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: fnError } = await supabase.functions.invoke("onboard-organization", {
      body: { organizationName, adminEmail, adminFullName },
    });

    setLoading(false);

    if (fnError) {
      setError(fnError.message);
      return;
    }
    if (data?.error) {
      setError(data.error);
      return;
    }

    setOpen(false);
    setOrganizationName("");
    setAdminEmail("");
    setAdminFullName("");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-deep px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-deepLight"
      >
        Registrar clínica nueva
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-line bg-white/60 p-6"
    >
      <p className="font-display text-lg text-deep">Registrar clínica nueva</p>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Nombre de la clínica</label>
        <input
          required
          value={organizationName}
          onChange={(e) => setOrganizationName(e.target.value)}
          className="rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep"
          placeholder="Clínica Ejemplo"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Correo del administrador</label>
        <input
          required
          type="email"
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
          className="rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep"
          placeholder="admin@clinicaejemplo.com"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Nombre del administrador</label>
        <input
          required
          value={adminFullName}
          onChange={(e) => setAdminFullName(e.target.value)}
          className="rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep"
          placeholder="Nombre Apellido"
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
          {loading ? "Creando..." : "Crear clínica y enviar invitación"}
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
