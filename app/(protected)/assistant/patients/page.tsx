import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreatePatientForm } from "@/components/CreatePatientForm";
import type { Patient, Profile } from "@/lib/types";

const CATEGORY_LABELS: Record<string, string> = {
  child: "Niño/a",
  adolescent: "Adolescente",
  adult: "Adulto",
};

export default async function AssistantPatientsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, clinic_id")
    .eq("id", user!.id)
    .single<Profile>();

  const [{ data: patients }, { data: therapists }] = await Promise.all([
    supabase
      .from("patients")
      .select("id, full_name, category, contact_email, contact_phone, active, primary_therapist_id, created_at")
      .order("full_name", { ascending: true })
      .returns<Patient[]>(),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("clinic_id", profile!.clinic_id!)
      .eq("role", "therapist")
      .order("full_name", { ascending: true })
      .returns<{ id: string; full_name: string }[]>(),
  ]);

  const therapistNameById = new Map((therapists ?? []).map((t) => [t.id, t.full_name]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="font-display text-2xl text-deep">Pacientes de la clínica</p>
        <CreatePatientForm
          organizationId={profile!.organization_id!}
          clinicId={profile!.clinic_id!}
          createdBy={user!.id}
          assignableTherapists={therapists ?? []}
        />
      </div>

      {patients && patients.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-line bg-white/60">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink/40">
                <th className="px-5 py-3 font-medium">Nombre</th>
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
                    <Link href={`/assistant/patients/${patient.id}`} className="hover:underline">
                      {patient.full_name}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-ink/70">
                    {CATEGORY_LABELS[patient.category] ?? patient.category}
                  </td>
                  <td className="px-5 py-3.5 text-ink/70">
                    {patient.primary_therapist_id
                      ? (therapistNameById.get(patient.primary_therapist_id) ?? "—")
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
        <p className="text-sm text-ink/50">Todavía no hay pacientes registrados en la clínica.</p>
      )}
    </div>
  );
}
