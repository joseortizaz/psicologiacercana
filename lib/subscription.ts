// Réplica en TypeScript de las reglas de org_lock_at() / org_access_state()
// (supabase/migrations/20260811000000_subscription_lock_and_renewal.sql), solo
// para MOSTRAR el estado de una organización al super_admin en tablas y
// fichas sin una consulta extra por fila. La base de datos es la que manda:
// el bloqueo real lo aplican sus triggers, y el aviso del profesional sale de
// my_org_access_state(). Si cambias un plazo, cámbialo en los dos lados.

import type { BillingCycle, Organization } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;
export const GRACE_DAYS: Record<BillingCycle, number> = { monthly: 10, annual: 20 };

type OrgDates = Pick<
  Organization,
  "status" | "subscription_status" | "trial_ends_at" | "billing_cycle" | "paid_until"
>;

// Momento en que pasa a solo lectura; null = sin fecha (no se bloquea por fecha).
export function lockAt(org: OrgDates): Date | null {
  if (org.status !== "active") return new Date(0);
  if (org.subscription_status === "trial") {
    return org.trial_ends_at ? new Date(org.trial_ends_at) : null;
  }
  if (!org.paid_until) return null;
  return new Date(new Date(org.paid_until).getTime() + GRACE_DAYS[org.billing_cycle] * DAY_MS);
}

export function isLocked(org: OrgDates, now = new Date()): boolean {
  const at = lockAt(org);
  return at !== null && at.getTime() <= now.getTime();
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" });
}
