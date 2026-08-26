"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccountType = "clinic" | "independent";
type ClinicalRole = "therapist" | "psychiatrist";

// Ver plan-independientes-y-credenciales-cercana.md, secciones A.2/A.3: un
// psicólogo o psiquiatra que se registra solo necesita, con la misma
// cuenta, administrar su "clínica" de una persona Y atender pacientes --
// hoy org_admin no tiene acceso clínico. El backoffice de super_admin
// (donde vive este formulario) pregunta primero qué tipo de cuenta es.
export function OnboardOrganizationForm() {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>("clinic");
  const [clinicalRole, setClinicalRole] = useState<ClinicalRole>("therapist");
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
      body: {
        accountType,
        organizationName,
        adminEmail,
        adminFullName,
        ...(accountType === "independent" ? { clinicalRole } : {}),
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
    setAccountType("clinic");
    setClinicalRole("therapist");
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
        Registrar organización nueva
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-line bg-white/60 p-6"
    >
      <p className="font-display text-lg text-deep">Registrar organización nueva</p>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Tipo de cuenta</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAccountType("clinic")}
            className={`flex-1 rounded-md border px-3.5 py-2.5 text-left text-sm transition ${
              accountType === "clinic"
                ? "border-deep bg-deep/5 text-deep"
                : "border-line bg-white text-ink/70 hover:border-deep/40"
            }`}
          >
            <span className="block font-medium">Clínica con varias personas</span>
            <span className="block text-xs text-ink/50">
              El administrador gestiona; otros terapeutas/psiquiatras atienden.
            </span>
          </button>
          <button
            type="button"
            onClick={() => setAccountType("independent")}
            className={`flex-1 rounded-md border px-3.5 py-2.5 text-left text-sm transition ${
              accountType === "independent"
                ? "border-deep bg-deep/5 text-deep"
                : "border-line bg-white text-ink/70 hover:border-deep/40"
            }`}
          >
            <span className="block font-medium">Profesional independiente</span>
            <span className="block text-xs text-ink/50">
              La misma cuenta administra y atiende pacientes.
            </span>
          </button>
        </div>
      </div>

      {accountType === "independent" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink/80">Es</label>
          <select
            value={clinicalRole}
            onChange={(e) => setClinicalRole(e.target.value as ClinicalRole)}
            className="rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep"
          >
            <option value="therapist">Psicólogo/a</option>
            <option value="psychiatrist">Psiquiatra</option>
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">
          {accountType === "independent" ? "Nombre del consultorio" : "Nombre de la clínica"}
        </label>
        <input
          required
          value={organizationName}
          onChange={(e) => setOrganizationName(e.target.value)}
          className="rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep"
          placeholder={accountType === "independent" ? "Puede ser tu propio nombre" : "Clínica Ejemplo"}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">
          {accountType === "independent" ? "Correo del profesional" : "Correo del administrador"}
        </label>
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
        <label className="text-sm font-medium text-ink/80">
          {accountType === "independent" ? "Nombre del profesional" : "Nombre del administrador"}
        </label>
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
          {loading ? "Creando..." : "Crear y enviar invitación"}
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
