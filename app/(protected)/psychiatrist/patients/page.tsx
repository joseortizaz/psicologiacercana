import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ExportCsvButton } from "@/components/ExportCsvButton";

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

  const { data: teamRows } = await supabase
    .from("clinical_record_team_members")
    .select(
      "id, clinical_record:clinical_records(id, status, chief_complaint, patient:patients(id, full_name, category, active))",
    )
    .eq("clinician_id", user!.id)
    .eq("active", true)
    .returns<TeamRow[]>();

  const patients = (teamRows ?? [])
    .map((row) => row.clinical_record?.patient)
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="font-display text-2xl text-deep">Pacientes</p>
        <ExportCsvButton
          rows={patients}
          columns={PATIENT_EXPORT_COLUMNS}
          filename="pacientes.csv"
          auditTable="patients"
        />
      </div>

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
          Todavía no eres miembro del equipo de atención de ningún expediente. Pídele al terapeuta
          a cargo que te agregue desde el expediente del paciente.
        </p>
      )}
    </div>
  );
}
