"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Organization } from "@/lib/types";

const STATUS_LABELS: Record<Organization["status"], string> = {
  active: "Activa",
  suspended: "Suspendida",
  cancelled: "Cancelada",
};

const STATUS_STYLES: Record<Organization["status"], string> = {
  active: "bg-sage/15 text-sage",
  suspended: "bg-clay/15 text-clay",
  cancelled: "bg-ink/10 text-ink/50",
};

export function OrganizationsTable({ initialOrganizations }: { initialOrganizations: Organization[] }) {
  const supabase = createClient();
  const [organizations, setOrganizations] = useState(initialOrganizations);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function toggleStatus(org: Organization) {
    const nextStatus = org.status === "active" ? "suspended" : "active";
    setUpdatingId(org.id);

    const { error } = await supabase
      .from("organizations")
      .update({ status: nextStatus })
      .eq("id", org.id);

    setUpdatingId(null);

    if (error) {
      alert(`No se pudo actualizar: ${error.message}`);
      return;
    }

    setOrganizations((prev) =>
      prev.map((o) => (o.id === org.id ? { ...o, status: nextStatus } : o)),
    );
  }

  if (organizations.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-ink/50">
        Todavía no hay ninguna clínica registrada.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white/60">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-wide text-ink/40">
            <th className="px-5 py-3 font-medium">Clínica</th>
            <th className="px-5 py-3 font-medium">Plan</th>
            <th className="px-5 py-3 font-medium">Estado</th>
            <th className="px-5 py-3 font-medium">Registrada</th>
            <th className="px-5 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {organizations.map((org) => (
            <tr key={org.id} className="border-b border-line last:border-0">
              <td className="px-5 py-3.5 font-medium text-ink">
                <Link
                  href={`/super-admin/organizations/${org.id}`}
                  className="hover:underline"
                >
                  {org.name}
                </Link>
              </td>
              <td className="px-5 py-3.5 capitalize text-ink/70">{org.plan}</td>
              <td className="px-5 py-3.5">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[org.status]}`}
                >
                  {STATUS_LABELS[org.status]}
                </span>
              </td>
              <td className="px-5 py-3.5 text-ink/50">
                {new Date(org.created_at).toLocaleDateString("es-DO")}
              </td>
              <td className="px-5 py-3.5 text-right">
                {org.status !== "cancelled" && (
                  <button
                    onClick={() => toggleStatus(org)}
                    disabled={updatingId === org.id}
                    className="text-xs font-medium text-deep underline decoration-deep/30 underline-offset-2 transition hover:decoration-deep disabled:opacity-50"
                  >
                    {updatingId === org.id
                      ? "Guardando..."
                      : org.status === "active"
                        ? "Suspender"
                        : "Reactivar"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
