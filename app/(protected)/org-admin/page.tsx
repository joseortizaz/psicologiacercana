import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InviteUserForm } from "@/components/InviteUserForm";
import { CreateClinicForm } from "@/components/CreateClinicForm";
import type { Clinic, Profile } from "@/lib/types";

const ROLE_LABELS: Record<string, string> = {
  org_admin: "Administrador",
  therapist: "Terapeuta",
  assistant: "Asistente",
  supervisor: "Supervisor",
};

export default async function OrgAdminPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user!.id)
    .single();

  if (profile?.role !== "org_admin") {
    redirect("/");
  }

  const [{ data: clinics }, { data: team }] = await Promise.all([
    supabase
      .from("clinics")
      .select("id, organization_id, name, active, created_at")
      .order("created_at", { ascending: true })
      .returns<Clinic[]>(),
    supabase
      .from("profiles")
      .select("id, organization_id, clinic_id, role, full_name, email, active")
      .order("full_name", { ascending: true })
      .returns<Profile[]>(),
  ]);

  const clinicNameById = new Map((clinics ?? []).map((c) => [c.id, c.name]));

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="font-display text-2xl text-deep">Sucursales</p>
          <CreateClinicForm organizationId={profile.organization_id!} />
        </div>

        {clinics && clinics.length > 0 ? (
          <ul className="flex flex-wrap gap-3">
            {clinics.map((c) => (
              <li
                key={c.id}
                className="rounded-full border border-line bg-white/60 px-4 py-1.5 text-sm text-ink/80"
              >
                {c.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink/50">
            Todavía no tienes ninguna sucursal. Crea la primera para poder invitar terapeutas y
            asistentes.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="font-display text-2xl text-deep">Equipo</p>
          <InviteUserForm clinics={clinics ?? []} />
        </div>

        <div className="overflow-hidden rounded-lg border border-line bg-white/60">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink/40">
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Correo</th>
                <th className="px-5 py-3 font-medium">Rol</th>
                <th className="px-5 py-3 font-medium">Sucursal</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {(team ?? []).map((member) => (
                <tr key={member.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3.5 font-medium text-ink">{member.full_name}</td>
                  <td className="px-5 py-3.5 text-ink/70">{member.email}</td>
                  <td className="px-5 py-3.5 text-ink/70">{ROLE_LABELS[member.role] ?? member.role}</td>
                  <td className="px-5 py-3.5 text-ink/70">
                    {member.clinic_id ? (clinicNameById.get(member.clinic_id) ?? "—") : "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        member.active ? "bg-sage/15 text-sage" : "bg-ink/10 text-ink/50"
                      }`}
                    >
                      {member.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
