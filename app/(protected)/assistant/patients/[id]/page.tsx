import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ScheduleAppointmentForm } from "@/components/ScheduleAppointmentForm";
import { AppointmentStatusButtons } from "@/components/AppointmentStatusButtons";
import { EditPatientForm } from "@/components/EditPatientForm";
import type { Appointment, Patient } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

const CATEGORY_LABELS: Record<string, string> = {
  child: "Niño/a",
  adolescent: "Adolescente",
  adult: "Adulto",
};

const MODALITY_LABELS: Record<string, string> = {
  in_person: "Presencial",
  virtual: "Virtual",
  phone: "Telefónica",
};

// Ver nota equivalente en el detalle de paciente del panel de terapeuta: los
// campos `date` de Postgres llegan como "YYYY-MM-DD" y hay que forzar la hora
// local para que no se corran un día en zonas detrás de UTC.
function formatDateOnly(dateStr: string, options?: Intl.DateTimeFormatOptions) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("es-MX", options);
}

export default async function AssistantPatientDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, clinic_id")
    .eq("id", user!.id)
    .single();

  const { data: patient } = await supabase
    .from("patients")
    .select(
      "id, organization_id, clinic_id, full_name, date_of_birth, category, national_id, gender, contact_phone, contact_email, address, occupation, education_level, referred_by, insurance_provider, insurance_policy_number, guardian_name, guardian_relationship, guardian_phone, guardian_national_id, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, active, primary_therapist_id",
    )
    .eq("id", params.id)
    .single<Patient>();

  if (!patient) {
    notFound();
  }

  const [{ data: appointments }, { data: therapists }] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, start_time, end_time, modality, session_type, status, therapist:profiles!appointments_therapist_id_fkey(full_name)",
      )
      .eq("patient_id", patient.id)
      .order("start_time", { ascending: false })
      .returns<(Appointment & { therapist: { full_name: string } | { full_name: string }[] | null })[]>(),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("clinic_id", profile!.clinic_id!)
      .eq("role", "therapist")
      .order("full_name", { ascending: true })
      .returns<{ id: string; full_name: string }[]>(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/assistant/patients" className="text-sm text-ink/50 hover:text-ink">
          ← Pacientes
        </Link>
      </div>

      <section className="rounded-lg border border-line bg-white/60 p-6">
        <div className="flex items-center justify-between">
          <p className="font-display text-2xl text-deep">{patient.full_name}</p>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              patient.active ? "bg-sage/15 text-sage" : "bg-ink/10 text-ink/50"
            }`}
          >
            {patient.active ? "Activo" : "Inactivo"}
          </span>
        </div>

        <div className="mt-4 grid gap-x-6 gap-y-2 text-sm text-ink/70 sm:grid-cols-3">
          <p>Categoría: {CATEGORY_LABELS[patient.category] ?? patient.category}</p>
          <p>Nacimiento: {formatDateOnly(patient.date_of_birth)}</p>
          <p>Género: {patient.gender ?? "—"}</p>
          <p>Correo: {patient.contact_email ?? "—"}</p>
          <p>Teléfono: {patient.contact_phone ?? "—"}</p>
          <p>Identificación: {patient.national_id ?? "—"}</p>
          <p>Dirección: {patient.address ?? "—"}</p>
          <p>Ocupación: {patient.occupation ?? "—"}</p>
          <p>Referido por: {patient.referred_by ?? "—"}</p>
          <p>
            Terapeuta:{" "}
            {patient.primary_therapist_id
              ? (therapists ?? []).find((t) => t.id === patient.primary_therapist_id)?.full_name ??
                "—"
              : "Sin asignar"}
          </p>
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <EditPatientForm
            patient={patient}
            assignableTherapists={therapists ?? []}
          />
        </div>

        {(patient.guardian_name || patient.emergency_contact_name || patient.insurance_provider) && (
          <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-3">
            {patient.guardian_name && (
              <div>
                <p className="text-xs uppercase tracking-wide text-ink/40">Tutor</p>
                <p className="mt-1 text-sm text-ink/70">
                  {patient.guardian_name}
                  {patient.guardian_relationship ? ` · ${patient.guardian_relationship}` : ""}
                </p>
                {patient.guardian_phone && (
                  <p className="text-sm text-ink/70">{patient.guardian_phone}</p>
                )}
              </div>
            )}
            {patient.emergency_contact_name && (
              <div>
                <p className="text-xs uppercase tracking-wide text-ink/40">Contacto de emergencia</p>
                <p className="mt-1 text-sm text-ink/70">
                  {patient.emergency_contact_name}
                  {patient.emergency_contact_relationship
                    ? ` · ${patient.emergency_contact_relationship}`
                    : ""}
                </p>
                {patient.emergency_contact_phone && (
                  <p className="text-sm text-ink/70">{patient.emergency_contact_phone}</p>
                )}
              </div>
            )}
            {patient.insurance_provider && (
              <div>
                <p className="text-xs uppercase tracking-wide text-ink/40">Seguro</p>
                <p className="mt-1 text-sm text-ink/70">{patient.insurance_provider}</p>
                {patient.insurance_policy_number && (
                  <p className="text-sm text-ink/70">Póliza {patient.insurance_policy_number}</p>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="font-display text-xl text-deep">Citas</p>
          <ScheduleAppointmentForm
            organizationId={patient.organization_id}
            clinicId={patient.clinic_id}
            patientId={patient.id}
            assignableTherapists={therapists ?? []}
          />
        </div>

        {appointments && appointments.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-line bg-white/60">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-ink/40">
                  <th className="px-5 py-3 font-medium">Fecha</th>
                  <th className="px-5 py-3 font-medium">Terapeuta</th>
                  <th className="px-5 py-3 font-medium">Modalidad</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appt) => {
                  const therapist = Array.isArray(appt.therapist) ? appt.therapist[0] : appt.therapist;
                  return (
                    <tr key={appt.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3.5 text-ink/70">
                        {new Date(appt.start_time).toLocaleString("es-MX", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-5 py-3.5 text-ink/70">{therapist?.full_name ?? "—"}</td>
                      <td className="px-5 py-3.5 text-ink/70">
                        {MODALITY_LABELS[appt.modality] ?? appt.modality}
                      </td>
                      <td className="px-5 py-3.5 text-ink/70">
                        {STATUS_LABELS[appt.status] ?? appt.status}
                      </td>
                      <td className="px-5 py-3.5">
                        <AppointmentStatusButtons appointmentId={appt.id} status={appt.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-ink/50">Sin citas registradas todavía.</p>
        )}
      </section>
    </div>
  );
}
