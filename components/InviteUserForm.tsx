"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Clinic, UserRole } from "@/lib/types";

const INVITABLE_ROLES: { value: UserRole; label: string; needsClinic: boolean }[] = [
  { value: "therapist", label: "Terapeuta", needsClinic: true },
  { value: "assistant", label: "Asistente administrativa", needsClinic: true },
  { value: "supervisor", label: "Supervisor clínico", needsClinic: true },
  { value: "org_admin", label: "Administrador de clínica", needsClinic: false },
];

export function InviteUserForm({ clinics }: { clinics: Clinic[] }) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("therapist");
  const [clinicId, setClinicId] = useState(clinics[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRole = INVITABLE_ROLES.find((r) => r.value === role)!;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: fnError } = await supabase.functions.invoke("invite-user", {
      body: {
        email,
        fullName,
        role,
        clinicId: selectedRole.needsClinic ? clinicId : undefined,
      },
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
    setEmail("");
    setFullName("");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={clinics.length === 0}
        className="rounded-md bg-deep px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-deepLight disabled:opacity-50"
        title={clinics.length === 0 ? "Crea una sucursal primero" : undefined}
      >
        Invitar personal
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-line bg-white/60 p-6"
    >
      <p className="font-display text-lg text-deep">Invitar personal</p>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Correo</label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep"
          placeholder="persona@ejemplo.com"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Nombre completo</label>
        <input
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep"
          placeholder="Nombre Apellido"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Rol</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className="rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep"
        >
          {INVITABLE_ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {selectedRole.needsClinic && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink/80">Sucursal</label>
          <select
            required
            value={clinicId}
            onChange={(e) => setClinicId(e.target.value)}
            className="rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep"
          >
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

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
          {loading ? "Enviando..." : "Enviar invitación"}
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
