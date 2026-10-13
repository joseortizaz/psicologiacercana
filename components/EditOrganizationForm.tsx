"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { BillingCycle, Organization, OrganizationStatus, Plan, SubscriptionStatus } from "@/lib/types";

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

const SUBSCRIPTION_OPTIONS: { value: SubscriptionStatus; label: string }[] = [
  { value: "trial", label: "En prueba gratuita" },
  { value: "active", label: "Con plan activo" },
];

// Valor para <input type="datetime-local"> (hora local del navegador) a
// partir de un ISO de la base de datos.
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
  // Estado de suscripción: "en prueba" o "con plan". Lo que está guardado en
  // la base (savedStatus) se distingue de lo que el formulario tiene
  // seleccionado (subscriptionStatus): al pasar de plan a prueba, la base fija
  // la ventana de 14 días sola (trigger apply_trial_window) salvo que aquí se
  // indique una fecha propia.
  const [savedStatus, setSavedStatus] = useState<SubscriptionStatus>(organization.subscription_status);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>(
    organization.subscription_status,
  );
  const [trialStartedAt, setTrialStartedAt] = useState(organization.trial_started_at);
  // El campo de fin de prueba solo se envía si el super_admin lo tocó: antes
  // se reenviaba siempre, y como el input era solo-fecha, cada guardado
  // pisaba la hora exacta de aprobación con medianoche UTC.
  const initialTrialInput = (status: SubscriptionStatus, endsAt: string | null) =>
    status === "trial" ? isoToLocalInput(endsAt) : "";
  const [initialTrialEndsAt, setInitialTrialEndsAt] = useState(
    initialTrialInput(organization.subscription_status, organization.trial_ends_at),
  );
  const [trialEndsAt, setTrialEndsAt] = useState(initialTrialEndsAt);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(organization.billing_cycle);
  // Igual que el fin de prueba: la próxima fecha de pago solo se envía si se
  // editó. Lo normal es moverla registrando un pago (panel de arriba).
  const [initialPaidUntil, setInitialPaidUntil] = useState(isoToLocalInput(organization.paid_until));
  const [paidUntil, setPaidUntil] = useState(initialPaidUntil);
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

    const { data: updated, error: updateError } = await supabase
      .from("organizations")
      .update({
        name,
        legal_name: legalName || null,
        tax_id: taxId || null,
        plan_id: planId,
        status,
        subscription_status: subscriptionStatus,
        billing_email: billingEmail || null,
        country,
        timezone,
        // Solo si se editó (ver comentario en initialTrialEndsAt).
        ...(trialEndsAt !== initialTrialEndsAt
          ? { trial_ends_at: trialEndsAt ? new Date(trialEndsAt).toISOString() : null }
          : {}),
        billing_cycle: billingCycle,
        ...(paidUntil !== initialPaidUntil
          ? { paid_until: paidUntil ? new Date(paidUntil).toISOString() : null }
          : {}),
        max_clinics: Number(maxClinics) || 1,
      })
      .eq("id", organization.id)
      .select("subscription_status, trial_started_at, trial_ends_at, paid_until")
      .single();

    setLoading(false);

    if (updateError || !updated) {
      setError(updateError?.message ?? "No se pudo guardar.");
      return;
    }

    // Resincronizar con lo que la base realmente guardó (el trigger pudo
    // haber fijado las fechas de la prueba).
    const nextInput = initialTrialInput(updated.subscription_status, updated.trial_ends_at);
    setSavedStatus(updated.subscription_status);
    setTrialStartedAt(updated.trial_started_at);
    const nextPaid = isoToLocalInput(updated.paid_until);
    setInitialPaidUntil(nextPaid);
    setPaidUntil(nextPaid);
    setInitialTrialEndsAt(nextInput);
    setTrialEndsAt(nextInput);

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
        <Field label="Tipo de cuenta">
          <select
            value={subscriptionStatus}
            onChange={(e) => setSubscriptionStatus(e.target.value as SubscriptionStatus)}
            className={inputClass}
          >
            {SUBSCRIPTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
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
        {subscriptionStatus === "trial" && (
          <Field label="Fin de la prueba gratuita">
            <input
              type="datetime-local"
              value={trialEndsAt}
              onChange={(e) => setTrialEndsAt(e.target.value)}
              className={inputClass}
            />
            <p className="text-xs text-ink/50">
              {savedStatus !== "trial"
                ? "Déjalo vacío para que la prueba dure 14 días completos desde el momento en que guardes. Si indicas una fecha, se usa esa."
                : trialStartedAt
                  ? `La prueba comenzó el ${formatDateTime(trialStartedAt)}. Cambia esta fecha para extenderla o acortarla.`
                  : "Cambia esta fecha para extender o acortar la prueba."}
            </p>
          </Field>
        )}
        {subscriptionStatus === "active" && (
          <>
            <Field label="Ciclo de facturación">
              <select
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
                className={inputClass}
              >
                <option value="monthly">Mensual</option>
                <option value="annual">Anual</option>
              </select>
            </Field>
            <Field label="Próxima fecha de pago">
              <input
                type="datetime-local"
                value={paidUntil}
                onChange={(e) => setPaidUntil(e.target.value)}
                className={inputClass}
              />
              <p className="text-xs text-ink/50">
                Lo normal es registrar un pago arriba, que la mueve sola. Sin fecha, la cuenta no se
                bloquea por vencimiento.
              </p>
            </Field>
          </>
        )}
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

      {subscriptionStatus === "active" && trialStartedAt && (
        <p className="text-xs text-ink/50">
          Esta cuenta tuvo una prueba gratuita desde el {formatDateTime(trialStartedAt)}. Si la
          pasas de nuevo a &quot;En prueba gratuita&quot;, los 14 días vuelven a contar desde el
          momento en que guardes.
        </p>
      )}

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
