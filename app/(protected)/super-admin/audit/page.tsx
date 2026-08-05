import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  AUDIT_ACTION_BADGE_CLASSES,
  AUDIT_ACTION_LABELS,
  AUDIT_TABLE_LABELS,
  type AuditLogEntry,
} from "@/lib/audit";

const MAX_ROWS = 300;

export default async function SuperAdminAuditPage({
  searchParams,
}: {
  searchParams: { table?: string; action?: string; org?: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  if (profile?.role !== "super_admin") {
    redirect("/");
  }

  const tableFilter = searchParams.table;
  const actionFilter = searchParams.action;
  const orgFilter = searchParams.org;

  // RLS (audit_logs_select) permite a super_admin ver eventos de todas las
  // organizaciones.
  let query = supabase
    .from("audit_logs")
    .select("id, actor_id, organization_id, table_name, record_id, action, occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(MAX_ROWS);

  if (tableFilter) query = query.eq("table_name", tableFilter);
  if (actionFilter) query = query.eq("action", actionFilter);
  if (orgFilter) query = query.eq("organization_id", orgFilter);

  const [{ data: logs }, { data: organizations }] = await Promise.all([
    query.returns<AuditLogEntry[]>(),
    supabase.from("organizations").select("id, name").order("name", { ascending: true }),
  ]);

  const actorIds = Array.from(
    new Set((logs ?? []).map((l) => l.actor_id).filter((id): id is string => !!id)),
  );

  const { data: actors } =
    actorIds.length > 0
      ? await supabase.from("profiles").select("id, full_name, email").in("id", actorIds)
      : { data: [] as { id: string; full_name: string; email: string }[] };

  const actorById = new Map((actors ?? []).map((a) => [a.id, a]));
  const orgNameById = new Map((organizations ?? []).map((o) => [o.id, o.name]));

  const buildHref = (overrides: { table?: string; action?: string; org?: string }) => {
    const params = new URLSearchParams();
    const table = "table" in overrides ? overrides.table : tableFilter;
    const action = "action" in overrides ? overrides.action : actionFilter;
    const org = "org" in overrides ? overrides.org : orgFilter;
    if (table) params.set("table", table);
    if (action) params.set("action", action);
    if (org) params.set("org", org);
    const qs = params.toString();
    return `/super-admin/audit${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-2xl text-deep">Auditoría</p>
          <p className="mt-1 text-sm text-ink/50">
            Registro inmutable de creación, edición, eliminación y acceso a datos sensibles en
            toda la plataforma. Mostrando los {Math.min(logs?.length ?? 0, MAX_ROWS)} eventos más
            recientes.
          </p>
        </div>
        <Link
          href="/super-admin"
          className="text-sm font-medium text-deep underline decoration-deep/30 underline-offset-2"
        >
          Volver
        </Link>
      </div>

      {organizations && organizations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <FilterPill href={buildHref({ org: undefined })} active={!orgFilter} label="Todas las clínicas" />
          {organizations.map((o) => (
            <FilterPill
              key={o.id}
              href={buildHref({ org: o.id })}
              active={orgFilter === o.id}
              label={o.name}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <FilterPill
          href={buildHref({ table: undefined })}
          active={!tableFilter}
          label="Todas las tablas"
        />
        {Object.entries(AUDIT_TABLE_LABELS).map(([key, label]) => (
          <FilterPill
            key={key}
            href={buildHref({ table: key })}
            active={tableFilter === key}
            label={label}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(AUDIT_ACTION_LABELS).map(([key, label]) => (
          <FilterPill
            key={key}
            href={buildHref({ action: actionFilter === key ? undefined : key })}
            active={actionFilter === key}
            label={label}
          />
        ))}
      </div>

      {logs && logs.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-line bg-white/60">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink/40">
                <th className="px-5 py-3 font-medium">Fecha y hora</th>
                <th className="px-5 py-3 font-medium">Clínica</th>
                <th className="px-5 py-3 font-medium">Usuario</th>
                <th className="px-5 py-3 font-medium">Acción</th>
                <th className="px-5 py-3 font-medium">Tabla</th>
                <th className="px-5 py-3 font-medium">Registro</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const actor = log.actor_id ? actorById.get(log.actor_id) : undefined;
                return (
                  <tr key={log.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3.5 text-ink/70">
                      {new Date(log.occurred_at).toLocaleString("es-MX", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-5 py-3.5 text-ink/70">
                      {log.organization_id ? (orgNameById.get(log.organization_id) ?? "—") : "—"}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-ink">
                      {actor ? actor.full_name : log.actor_id ? "Usuario eliminado" : "Sistema"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          AUDIT_ACTION_BADGE_CLASSES[log.action] ?? "bg-ink/10 text-ink/50"
                        }`}
                      >
                        {AUDIT_ACTION_LABELS[log.action] ?? log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-ink/70">
                      {AUDIT_TABLE_LABELS[log.table_name] ?? log.table_name}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-ink/40">{log.record_id}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-ink/50">No hay eventos de auditoría con estos filtros.</p>
      )}
    </div>
  );
}

function FilterPill({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <a
      href={href}
      className={`rounded-full border px-4 py-1.5 text-sm transition ${
        active
          ? "border-deep bg-deep text-paper"
          : "border-line bg-white/60 text-ink/70 hover:border-deep/40"
      }`}
    >
      {label}
    </a>
  );
}
