"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Clinic, UserRole } from "@/lib/types";
import { ASSIGNABLE_ROLES } from "@/lib/roles";

// Ver plan-independientes-y-credenciales-cercana.md, sección B.3: la
// edge function invite-user ya no invita por correo -- crea la cuenta con
// una contraseña temporal generada por el sistema y la devuelve UNA SOLA
// VEZ en la respuesta. Este componente la muestra en un recuadro con botón
// de copiar; una vez que el admin cierra el formulario, esa contraseña no
// se puede volver a consultar (ni este componente ni la base de datos la
// guardan en texto plano).
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
  const [createdCredential, setCreatedCredential] = useState<{ email: string; password: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  const selectedRole = ASSIGNABLE_ROLES.find((r) => r.value === role)!;

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

    setCreatedCredential({ email, password: data.temporaryPassword });
    setEmail("");
    setFullName("");
    router.refresh();
  }

  async function handleCopy() {
    if (!createdCredential) return;
    try {
      await navigator.clipboard.writeText(createdCredential.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Portapapeles no disponible (contexto no seguro, permiso denegado,
      // etc.) -- la contraseña sigue visible en pantalla para copiar a
      // mano.
    }
  }

  function handleClose() {
    setOpen(false);
    setCreatedCredential(null);
    setCopied(false);
  }

  if (createdCredential) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-line bg-white/60 p-6">
        <p className="font-display text-lg text-deep">Cuenta creada</p>
        <p className="text-sm text-ink/70">
          Comparte esta contraseña temporal con <span className="font-medium">{createdCredential.email}</span> por
          el medio que prefieras (no tiene que ser correo). Va a tener que cambiarla al iniciar sesión por primera
          vez.
        </p>

        <div className="flex items-center gap-3 rounded-md border border-line bg-paper px-3.5 py-2.5">
          <code className="flex-1 select-all font-mono text-sm text-ink">{createdCredential.password}</code>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:border-deep/40 hover:text-ink"
          >
            {copied ? "¡Copiado!" : "Copiar"}
          </button>
        </div>

        <p className="text-xs text-ink/50">
          Esta contraseña no se volverá a mostrar. Si se pierde, tendrás que restablecerla desde el perfil de la
          persona.
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md bg-deep px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-deepLight"
          >
            Listo
          </button>
        </div>
      </div>
    );
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
          {ASSIGNABLE_ROLES.map((r) => (
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
          {loading ? "Creando..." : "Crear cuenta"}
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
