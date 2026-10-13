"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatDate, isLocked, lockAt } from "@/lib/subscription";
import { whatsappLink } from "@/lib/phone";
import type { BillingCycle, Organization, Plan, SubscriptionPayment } from "@/lib/types";

const inputClass = "rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep";

type OrgBilling = Pick<
  Organization,
  "id" | "plan_id" | "status" | "subscription_status" | "trial_ends_at" | "billing_cycle" | "paid_until"
>;

export interface OrgContact {
  full_name: string;
  email: string;
  phone: string | null;
  whatsapp_number: string | null;
}

function money(amount: number, currency: string) {
  return `${currency} ${Number(amount).toLocaleString("es-DO", { minimumFractionDigits: 2 })}`;
}

// Ficha de facturación de una organización (solo super_admin): estado de
// acceso, contacto, registro manual de pagos e historial.
export function SubscriptionPanel({
  organization,
  plans,
  payments,
  contacts,
}: {
  organization: OrgBilling;
  plans: Pick<Plan, "id" | "name">[];
  payments: SubscriptionPayment[];
  contacts: OrgContact[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [amount, setAmount] = useState("");
  const [cycle, setCycle] = useState<BillingCycle>(organization.billing_cycle);
  const [planId, setPlanId] = useState(organization.plan_id);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const locked = isLocked(organization);
  const lock = lockAt(organization);
  const planName = (id: string | null) => plans.find((p) => p.id === id)?.name ?? "—";

  let statusText: string;
  if (organization.status !== "active") {
    statusText = "Solo lectura: la cuenta está suspendida o cancelada.";
  } else if (organization.subscription_status === "trial") {
    statusText = organization.trial_ends_at
      ? `En prueba, termina el ${formatDate(organization.trial_ends_at)}. ${locked ? "Ya está en solo lectura." : ""}`
      : "En prueba, sin fecha de fin.";
  } else if (!organization.paid_until) {
    statusText = "Con plan, pero sin fecha de pago registrada: no se bloquea por fecha. Registra el primer pago para que empiece a regir el calendario.";
  } else {
    statusText = `Pagado hasta el ${formatDate(organization.paid_until)}. ${
      locked
        ? "Ya está en solo lectura."
        : lock
          ? `Pasa a solo lectura el ${formatDate(lock.toISOString())} si no hay pago.`
          : ""
    }`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0 || amount.trim() === "") {
      setError("Indica un monto válido.");
      return;
    }
    setLoading(true);
    const { data, error: rpcError } = await supabase
      .rpc("register_subscription_payment", {
        p_organization_id: organization.id,
        p_amount: value,
        p_billing_cycle: cycle,
        p_plan_id: planId,
        p_note: note || null,
      })
      .single<Organization>();
    setLoading(false);

    if (rpcError || !data) {
      setError(rpcError?.message ?? "No se pudo registrar el pago.");
      return;
    }
    setAmount("");
    setNote("");
    setDone(`Pago registrado. Cuenta activa hasta el ${data.paid_until ? formatDate(data.paid_until) : "—"}.`);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-5 rounded-lg border border-line bg-white/60 p-6">
      <div>
        <p className="font-display text-lg text-deep">Suscripción y pagos</p>
        <p
          className={`mt-1 text-sm ${locked ? "font-medium text-clay" : "text-ink/70"}`}
        >
          {statusText}
        </p>
      </div>

      {contacts.length > 0 && (
        <div className="text-sm">
          <p className="font-medium text-ink/80">Contacto</p>
          <ul className="mt-1 flex flex-col gap-1 text-ink/70">
            {contacts.map((c) => {
              const link = c.whatsapp_number ? whatsappLink(c.whatsapp_number) : null;
              return (
                <li key={c.email}>
                  {c.full_name} · {c.email}
                  {c.phone ? ` · Tel. ${c.phone}` : ""}
                  {c.whatsapp_number &&
                    (link ? (
                      <>
                        {" · "}
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-deep underline decoration-deep/30 underline-offset-2"
                        >
                          WhatsApp {c.whatsapp_number}
                        </a>
                      </>
                    ) : (
                      ` · WhatsApp ${c.whatsapp_number}`
                    ))}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <p className="text-sm font-medium text-ink/80 sm:col-span-2">
          Registrar un pago (activa la cuenta y mueve la próxima fecha de pago)
        </p>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-ink/70">Monto (DOP)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-ink/70">Periodo pagado</label>
          <select value={cycle} onChange={(e) => setCycle(e.target.value as BillingCycle)} className={inputClass}>
            <option value="monthly">Mensual</option>
            <option value="annual">Anual</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-ink/70">Plan</label>
          <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={inputClass}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-ink/70">Nota (referencia, transferencia…)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-clay sm:col-span-2">
            {error}
          </p>
        )}
        {done && <p className="text-sm text-sage sm:col-span-2">{done}</p>}
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-deep px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-deepLight disabled:opacity-60"
          >
            {loading ? "Registrando..." : "Registrar pago"}
          </button>
        </div>
      </form>

      <div>
        <p className="text-sm font-medium text-ink/80">Historial de pagos</p>
        {payments.length === 0 ? (
          <p className="mt-1 text-sm text-ink/50">Todavía no hay pagos registrados.</p>
        ) : (
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink/40">
                <th className="py-2 pr-3 font-medium">Fecha</th>
                <th className="py-2 pr-3 font-medium">Monto</th>
                <th className="py-2 pr-3 font-medium">Plan</th>
                <th className="py-2 pr-3 font-medium">Cubre hasta</th>
                <th className="py-2 font-medium">Nota</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="py-2 pr-3">{formatDate(p.paid_at)}</td>
                  <td className="py-2 pr-3">{money(p.amount, p.currency)}</td>
                  <td className="py-2 pr-3">
                    {planName(p.plan_id)} · {p.billing_cycle === "annual" ? "anual" : "mensual"}
                  </td>
                  <td className="py-2 pr-3">{formatDate(p.covers_until)}</td>
                  <td className="py-2 text-ink/60">{p.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
