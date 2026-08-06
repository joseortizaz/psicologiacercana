"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Organization, OrganizationStatus, Plan } from "@/lib/types";

type PlanOption = Pick<
  Plan,
  "id" | "name" | "tagline" | "max_therapists" | "max_org_admins" | "max_assistants" | "max_supervisors"
>;

function formatLimit(n: number | null) {
  return n === null ? "sin límite" : String(n);
}

const STATUS_OPTIONS: { value: OrganizationStatus; label: string }[] = [
  { value: "active", label: "Activa" },
  { value: "suspended", label: "Suspendida" },
  { value: "cancelled", label: "Cancelada" },
];

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

export function EditOrganizationForm({
  organization,
  plans,
}: {
  organization: Organization;
  plans: PlanOption[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState(organization.name);
  const [legalName, setLegalName] = useState(organization.legal_name ?? "");
  const [taxId, setTaxId] = useState(organization.tax_id ?? "");
  const [planId, setPlanId] = useState(organization.plan_id);
  const [status, setStatus] = useState<OrganizationStatus>(organization.status);
  const [billingEmail, setBillingEmail] = useState(organization.billing_email ?? "");
  const [country, setCountry] = useState(organization.country);
  const [timezone, setTimezone] = useState(organization.timezone);
  const [trialEndsAt, setTrialEndsAt] = useState(
    organization.trial_ends_at ? organization.trial_ends_at.slice(0, 10) : "",
  );
  const [maxClinics, setMaxClinics] = useState(String(organization.max_clinics));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const selectedPlan = plans.find((p) => p.id === planId) ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    const { error: updateError } = await supabase
      .from("organizations")
      .update({
        name,
        legal_name: legalName || null,
        tax_id: taxId || null,
        plan_id: planId,
        status,
        billing_email: billingEmail || null,
        country,
        timezone,
        trial_ends_at: trialEndsAt || null,
        max_clinics: Number(maxClinics) || 1,
      })
      .eq("id", organization.id);

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
        <Field label="Razón social (opcional)">
          <input
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="RNC / identificación fiscal (opcional)">
          <input value={taxId} onChange={(e) => setTaxId(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Correo de facturación (opcional)">
          <input
            type="email"
            value={billingEmail}
            onChange={(e) => setBillingEmail(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Plan">
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className={inputClass}
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Estado">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as OrganizationStatus)}
            className={inputClass}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="País">
          <input
            required
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Zona horaria">
          <input
            required
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Fin del período de prueba (opcional)">
          <input
            type="date"
            value={trialEndsAt}
            onChange={(e) => setTrialEndsAt(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Máximo de sucursales">
          <input
            required
            type="number"
            min={1}
            value={maxClinics}
            onChange={(e) => setMaxClinics(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      {selectedPlan && (
        <div className="rounded-md border border-line bg-paper/60 px-4 py-3 text-sm text-ink/70">
          <p className="font-medium text-ink">
            {selectedPlan.name}
            {selectedPlan.tagline ? ` — ${selectedPlan.tagline}` : ""}
          </p>
          <p className="mt-1 text-ink/60">
            Límites: {formatLimit(selectedPlan.max_therapists)} terapeuta(s),{" "}
            {formatLimit(selectedPlan.max_org_admins)} administrador(es),{" "}
            {formatLimit(selectedPlan.max_assistants)} asistente(s),{" "}
            {formatLimit(selectedPlan.max_supervisors)} supervisor(es)
          </p>
          <Link
            href="/super-admin/plans"
            className="mt-1.5 inline-block text-xs font-medium text-deep underline decoration-deep/30 underline-offset-2"
          >
            Editar planes
          </Link>
        </div>
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
