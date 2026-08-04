"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ASSIGNABLE_ROLES } from "@/lib/roles";
import type { Clinic, Profile, UserRole } from "@/lib/types";

const inputClass =
  "rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep disabled:opacity-60 disabled:bg-line/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-ink/80">{label}</label>
      {children}
    </div>
  );
}

export function EditStaffForm({
  member,
  clinics,
  isSelf,
}: {
  member: Profile;
  clinics: Clinic[];
  /** Si esta ficha es la del propio usuario que la edita: por seguridad no
   *  se permite cambiar el propio rol ni desactivarse a sí mismo. */
  isSelf: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState(member.full_name);
  const [phone, setPhone] = useState(member.phone ?? "");
  const [licenseNumber, setLicenseNumber] = useState(member.license_number ?? "");
  const [specialty, setSpecialty] = useState(member.specialty ?? "");
  const [role, setRole] = useState<UserRole>(member.role);
  const [clinicId, setClinicId] = useState(member.clinic_id ?? clinics[0]?.id ?? "");
  const [active, setActive] = useState(member.active);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const selectedRole = ASSIGNABLE_ROLES.find((r) => r.value === role);
  const needsClinic = selectedRole?.needsClinic ?? true;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone: phone || null,
        license_number: licenseNumber || null,
        specialty: specialty || null,
        role,
        clinic_id: needsClinic ? clinicId || null : null,
        active,
      })
      .eq("id", member.id);

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
        <Field label="Nombre completo">
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Correo">
          <input value={member.email} disabled className={inputClass} />
        </Field>
        <Field label="Teléfono (opcional)">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Número de licencia (opcional)">
          <input
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Especialidad (opcional)">
          <input
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            className={inputClass}
            placeholder="Terapia cognitivo-conductual, infantil, etc."
          />
        </Field>
        <Field label="Rol">
          <select
            required
            disabled={isSelf}
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className={inputClass}
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
        {needsClinic && (
          <Field label="Sucursal">
            <select
              required
              value={clinicId}
              onChange={(e) => setClinicId(e.target.value)}
              className={inputClass}
            >
              <option value="" disabled>
                Selecciona una sucursal
              </option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-ink/80">
        <input
          type="checkbox"
          disabled={isSelf}
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-4 w-4 rounded border-line disabled:opacity-60"
        />
        Cuenta activa
      </label>

      {isSelf && (
        <p className="text-xs text-ink/50">
          Por seguridad, no puedes cambiar tu propio rol ni desactivar tu propia cuenta.
        </p>
      )}

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
