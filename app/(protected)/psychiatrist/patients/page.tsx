import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { UnassignedPatientsPanel } from "@/components/UnassignedPatientsPanel";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { CreatePatientForm } from "@/components/CreatePatientForm";
import { ImportPatientsCsv } from "@/components/ImportPatientsCsv";
import type { Profile } from "@/lib/types";

const PATIENT_EXPORT_COLUMNS: { key: "full_name" | "category" | "active"; label: string }[] = [
  { key: "full_name", label: "Nombre" },
  { key: "category", label: "Categoría" },
  { key: "active", label: "Activo" },
];

const CATEGORY_LABELS: Record<string, string> = {
  child: "Niño/a",
  adolescent: "Adolescente",
  adult: "Adulto",
};

interface TeamRow {
  id: string;
  clinical_record: {
    id: string;
    status: string;
    chief_complaint: string | null;
    patient: {
      id: string;
      full_name: string;
      category: string;
      active: boolean;
    } | null;
  } | null;
}

export default async function PsychiatristPatientsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, clinic_id")
    .eq("id", user!.id)
    .single<Profile>();

  // Pacientes de la clínica sin profesional (registrados por una secretaria,
  // por ejemplo): el profesional se los puede asignar con un clic.
  let unassignedQuery = supabase
    .from("patients")
    .select("id, full_name")
    .is("primary_therapist_id", null)
    .eq("active", true)
    .order("full_name", { ascending: true });
  if (profile?.clinic_id) unassignedQuery = unassignedQuery.eq("clinic_id", profile.clinic_id);
  const { data: unassigned } = await unassignedQuery.returns<{ id: string; full_name: string }[]>();

  // Pacientes propios (dados de alta por el psiquiatra) + pacientes de
  // expedientes donde es miembro del equipo de atención.
  const { data: ownPatients } = await supabase
    .from("patients")
    .select("id, full_name, category, active")
    .eq("primary_therapist_id", user!.id)
    .returns<{ id: string; full_name: string; category: string; active: boolean }[]>();

  const { data: teamRows } = await supabase
    .from("clinical_record_team_members")
    .select(
      "id, clinical_record:clinical_records(id, status, chief_complaint, patient:patients(id, full_name, category, active))",
    )
    .eq("clinician_id", user!.id)
    .eq("active", true)
    .returns<TeamRow[]>();

  const byId = new Map<string, { id: string; full_name: string; category: string; active: boolean }>();
  for (const p of ownPatients ?? []) byId.set(p.id, p);
  for (const row of teamRows ?? []) {
    const p = row.clinical_record?.patient;
    if (p) byId.set(p.id, p);
  }
  const patients = Array.from(byId.values()).sort((a, b) =>
    a.full_name.localeCompare(b.full_name, "es"),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="font-display text-2xl text-deep">Pacientes</p>
        <div className="flex flex-wrap items-start gap-3">
          <ExportCsvButton
            rows={patients}
            columns={PATIENT_EXPORT_COLUMNS}
            filename="pacientes.csv"
            auditTable="patients"
          />
          <ImportPatientsCsv
            organizationId={profile!.organization_id!}
            clinicId={profile!.clinic_id!}
            therapistId={user!.id}
          />
          <CreatePatientForm
            organizationId={profile!.organization_id!}
            clinicId={profile!.clinic_id!}
            therapistId={user!.id}
          />
        </div>
      </div>

      <UnassignedPatientsPanel professionalId={user!.id} patients={unassigned ?? []} />

      {patients.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-line bg-white/60">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink/40">
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Categoría</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => (
                <tr key={patient.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3.5 font-medium text-ink">
                    <Link href={`/psychiatrist/patients/${patient.id}`} className="hover:underline">
                      {patient.full_name}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-ink/70">
                    {CATEGORY_LABELS[patient.category] ?? patient.category}
                  </td>
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
          Todavía no tienes pacientes. Registra uno con «Nuevo paciente» o pídele al terapeuta a
          cargo que te agregue al equipo de atención de un expediente.
        </p>
      )}
    </div>
  );
}
