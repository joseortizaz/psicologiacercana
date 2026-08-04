"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Clinic } from "@/lib/types";

const inputClass =
  "rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-ink/80">{label}</label>
      {children}
    </div>
  );
}

export function EditClinicForm({ clinic }: { clinic: Clinic }) {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState(clinic.name);
  const [address, setAddress] = useState(clinic.address ?? "");
  const [phone, setPhone] = useState(clinic.phone ?? "");
  const [email, setEmail] = useState(clinic.email ?? "");
  const [timezone, setTimezone] = useState(clinic.timezone ?? "");
  const [logoUrl, setLogoUrl] = useState(clinic.logo_url ?? "");
  const [primaryColor, setPrimaryColor] = useState(clinic.primary_color ?? "");
  const [active, setActive] = useState(clinic.active);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    const { error: updateError } = await supabase
      .from("clinics")
      .update({
        name,
        address: address || null,
        phone: phone || null,
        email: email || null,
        timezone: timezone || null,
        logo_url: logoUrl || null,
        primary_color: primaryColor || null,
        active,
      })
      .eq("id", clinic.id);

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-lg border border-line bg-white/60 p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Teléfono (opcional)">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Correo (opcional)">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Zona horaria (opcional)">
          <input
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className={inputClass}
            placeholder="America/Santo_Domingo"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Dirección (opcional)">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="URL del logo (opcional)">
          <input
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            className={inputClass}
            placeholder="https://..."
          />
        </Field>
        <Field label="Color primario (opcional)">
          <input
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className={inputClass}
            placeholder="#2d5a4a"
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-ink/80">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-4 w-4 rounded border-line"
        />
        Sucursal activa
      </label>

      {error && (
        <p role="alert" className="text-sm text-clay">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-deep px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-deepLight disabled:opacity-60"
        >
          {loading ? "Guardando..." : "Guardar cambios"}
        </button>
        {saved && !loading && <p className="text-sm text-sage">Cambios guardados.</p>}
      </div>
    </form>
  );
}
