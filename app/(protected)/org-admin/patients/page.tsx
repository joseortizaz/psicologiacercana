import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreatePatientForm } from "@/components/CreatePatientForm";
import { ImportPatientsCsv } from "@/components/ImportPatientsCsv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { hasAdminAccess } from "@/lib/roles";
import type { Clinic, Patient, Profile } from "@/lib/types";

interface PatientExportRow {
  full_name: string;
  clinic: string;
  category: string;
  therapist: string;
  contact_email: string;
  contact_phone: string;
  active: string;
  created_at: string;
}

const PATIENT_EXPORT_COLUMNS: { key: keyof PatientExportRow; label: string }[] = [
  { key: "full_name", label: "Nombre" },
  { key: "clinic", label: "Sucursal" },
  { key: "category", label: "Categoría" },
  { key: "therapist", label: "Terapeuta" },
  { key: "contact_email", label: "Correo" },
  { key: "contact_phone", label: "Teléfono" },
  { key: "active", label: "Activo" },
  { key: "created_at", label: "Creado" },
];

const CATEGORY_LABELS: Record<string, string> = {
  child: "Niño/a",
  adolescent: "Adolescente",
  adult: "Adulto",
};

export default async function OrgAdminPatientsPage({
  searchParams,
}: {
  searchParams: { clinic?: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id, is_org_admin")
    .eq("id", user!.id)
    .single<Profile>();

  if (!profile || !hasAdminAccess(profile)) {
    redirect("/");
  }

  const clinicFilter = searchParams.clinic;

  let patientsQuery = supabase
    .from("patients")
    .select(
      "id, clinic_id, full_name, category, contact_email, contact_phone, active, primary_therapist_id, created_at",
    )
    .order("full_name", { ascending: true });

  if (clinicFilter) {
    patientsQuery = patientsQuery.eq("clinic_id", clinicFilter);
  }

  const [{ data: patients }, { data: clinics }, { data: therapists }] = await Promise.all([
    patientsQuery.returns<Patient[]>(),
    supabase
      .from("clinics")
      .select(
        "id, organization_id, name, address, phone, email, timezone, logo_url, primary_color, active, created_at, updated_at",
      )
      .order("name", { ascending: true })
      .returns<Clinic[]>(),
    supabase
      .from("profiles")
      .select("id, full_name, clinic_id")
      .eq("role", "therapist")
      .order("full_name", { ascending: true })
      .returns<{ id: string; full_name: string; clinic_id: string | null }[]>(),
  ]);

  const clinicNameById = new Map((clinics ?? []).map((c) => [c.id, c.name]));
  const activeClinics = (clinics ?? []).filter((c) => c.active);

  const exportRows = (patients ?? []).map((p) => ({
    full_name: p.full_name,
    clinic: clinicNameById.get(p.clinic_id) ?? "",
    category: CATEGORY_LABELS[p.category] ?? p.category,
    therapist: p.primary_therapist_id
      ? ((therapists ?? []).find((t) => t.id === p.primary_therapist_id)?.full_name ?? "")
      : "Sin asignar",
    contact_email: p.contact_email ?? "",
    contact_phone: p.contact_phone ?? "",
    active: p.active ? "Sí" : "No",
    created_at: new Date(p.created_at).toLocaleDateString("es-MX", { dateStyle: "medium" }),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="font-display text-2xl text-deep">Pacientes</p>
        <div className="flex flex-wrap items-start gap-3">
          <ExportCsvButton
            rows={exportRows}
            columns={PATIENT_EXPORT_COLUMNS}
            filename="pacientes.csv"
            auditTable="patients"
          />
          {activeClinics.length > 0 && (
            <>
              <ImportPatientsCsv
                organizationId={profile!.organization_id!}
                createdBy={user!.id}
                assignableClinics={activeClinics.map((c) => ({ id: c.id, name: c.name }))}
                assignableTherapists={(therapists ?? []).map((t) => ({
                  id: t.id,
                  full_name: t.full_name,
                  clinic_id: t.clinic_id ?? undefined,
                }))}
              />
              <CreatePatientForm
                organizationId={profile!.organization_id!}
                createdBy={user!.id}
                assignableClinics={activeClinics.map((c) => ({ id: c.id, name: c.name }))}
                assignableTherapists={(therapists ?? []).map((t) => ({
                  id: t.id,
                  full_name: t.full_name,
                  clinic_id: t.clinic_id ?? undefined,
                }))}
              />
            </>
          )}
        </div>
      </div>

      {clinics && clinics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Link
            href="/org-admin/patients"
            className={`rounded-full border px-4 py-1.5 text-sm transition ${
              !clinicFilter
                ? "border-deep bg-deep text-paper"
                : "border-line bg-white/60 text-ink/70 hover:border-deep/40"
            }`}
          >
            Todas las sucursales
          </Link>
          {clinics.map((c) => (
            <Link
              key={c.id}
              href={`/org-admin/patients?clinic=${c.id}`}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${
                clinicFilter === c.id
                  ? "border-deep bg-deep text-paper"
                  : "border-line bg-white/60 text-ink/70 hover:border-deep/40"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {patients && patients.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-line bg-white/60">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink/40">
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Sucursal</th>
                <th className="px-5 py-3 font-medium">Categoría</th>
                <th className="px-5 py-3 font-medium">Terapeuta</th>
                <th className="px-5 py-3 font-medium">Correo</th>
                <th className="px-5 py-3 font-medium">Teléfono</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => (
                <tr key={patient.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3.5 font-medium text-ink">
                    <Link href={`/org-admin/patients/${patient.id}`} className="hover:underline">
                      {patient.full_name}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-ink/70">
                    {clinicNameById.get(patient.clinic_id) ?? "—"}
                  </td>
                  <td className="px-5 py-3.5 text-ink/70">
                    {CATEGORY_LABELS[patient.category] ?? patient.category}
                  </td>
                  <td className="px-5 py-3.5 text-ink/70">
                    {patient.primary_therapist_id
                      ? ((therapists ?? []).find((t) => t.id === patient.primary_therapist_id)
                          ?.full_name ?? "—")
                      : "Sin asignar"}
                  </td>
                  <td className="px-5 py-3.5 text-ink/70">{patient.contact_email ?? "—"}</td>
                  <td className="px-5 py-3.5 text-ink/70">{patient.contact_phone ?? "—"}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        patient.active ? "bg-sage/15 text-sage" : "bg-ink/10 text-ink/50"
                      }`}
                    >
                      {patient.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-ink/50">
          {clinicFilter
            ? "No hay pacientes registrados en esta sucursal."
            : "Todavía no hay pacientes registrados en la organización."}
        </p>
      )}
    </div>
  );
}
