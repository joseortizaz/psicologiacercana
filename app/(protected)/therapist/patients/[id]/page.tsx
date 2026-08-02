import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ScheduleAppointmentForm } from "@/components/ScheduleAppointmentForm";
import { AppointmentStatusButtons } from "@/components/AppointmentStatusButtons";
import { ClinicalRecordPanel } from "@/components/ClinicalRecordPanel";
import { AddConsultationForm } from "@/components/AddConsultationForm";
import type { Appointment, ClinicalRecord, Consultation, Patient } from "@/lib/types";

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

// Los campos `date` de Postgres (sin hora) llegan como "YYYY-MM-DD". Pasarlos
// directo a `new Date()` los interpreta como medianoche UTC, así que en
// zonas horarias detrás de UTC (como Santo Domingo) se muestra el día
// anterior. Forzamos la hora local para evitar ese corrimiento.
function formatDateOnly(dateStr: string, options?: Intl.DateTimeFormatOptions) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("es-MX", options);
}

export default async function PatientDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: patient } = await supabase
    .from("patients")
    .select(
      "id, organization_id, clinic_id, full_name, date_of_birth, category, national_id, gender, contact_phone, contact_email, address, occupation, education_level, referred_by, insurance_provider, insurance_policy_number, guardian_name, guardian_relationship, guardian_phone, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, active, primary_therapist_id",
    )
    .eq("id", params.id)
    .single<Patient>();

  if (!patient) {
    notFound();
  }

  const [{ data: appointments }, { data: clinicalRecord }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, start_time, end_time, modality, session_type, status")
      .eq("patient_id", patient.id)
      .order("start_time", { ascending: false })
      .returns<Appointment[]>(),
    supabase
      .from("clinical_records")
      .select(
        "id, organization_id, clinic_id, patient_id, primary_therapist_id, status, chief_complaint, diagnosis, diagnosis_hypothesis, therapeutic_objectives, treatment_plan, created_at, updated_at",
      )
      .eq("patient_id", patient.id)
      .eq("primary_therapist_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<ClinicalRecord>(),
  ]);

  const { data: consultations } = clinicalRecord
    ? await supabase
        .from("consultations")
        .select(
          "id, session_date, duration_minutes, modality, session_type, reason, objectives, interventions, techniques_used, observations, homework_tasks, status",
        )
        .eq("clinical_record_id", clinicalRecord.id)
        .order("session_date", { ascending: false })
        .returns<Consultation[]>()
    : { data: [] as Consultation[] };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/therapist/patients" className="text-sm text-ink/50 hover:text-ink">
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
            therapistId={user!.id}
            patientId={patient.id}
          />
        </div>

        {appointments && appointments.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-line bg-white/60">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-ink/40">
                  <th className="px-5 py-3 font-medium">Fecha</th>
                  <th className="px-5 py-3 font-medium">Modalidad</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appt) => (
                  <tr key={appt.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3.5 text-ink/70">
                      {new Date(appt.start_time).toLocaleString("es-MX", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
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
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-ink/50">Sin citas registradas todavía.</p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <p className="font-display text-xl text-deep">Expediente clínico y notas de sesión</p>

        <ClinicalRecordPanel
          organizationId={patient.organization_id}
          clinicId={patient.clinic_id}
          therapistId={user!.id}
          patientId={patient.id}
          record={clinicalRecord}
        />

        {clinicalRecord && (
          <>
            <AddConsultationForm
              organizationId={patient.organization_id}
              clinicId={patient.clinic_id}
              therapistId={user!.id}
              patientId={patient.id}
              clinicalRecordId={clinicalRecord.id}
            />

            {consultations && consultations.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {consultations.map((c) => (
                  <li key={c.id} className="rounded-lg border border-line bg-white/60 p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-wide text-ink/40">
                        {new Date(c.session_date).toLocaleDateString("es-MX", { dateStyle: "long" })}
                        {" · "}
                        {MODALITY_LABELS[c.modality] ?? c.modality}
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          c.status === "finalized"
                            ? "bg-sage/15 text-sage"
                            : "bg-ink/10 text-ink/50"
                        }`}
                      >
                        {c.status === "finalized" ? "Finalizada" : "Borrador"}
                      </span>
                    </div>
                    {c.reason && (
                      <p className="mt-2 text-sm text-ink/80">
                        <span className="font-medium">Motivo: </span>
                        {c.reason}
                      </p>
                    )}
                    {c.objectives && (
                      <p className="mt-1 text-sm text-ink/80">
                        <span className="font-medium">Objetivos: </span>
                        {c.objectives}
                      </p>
                    )}
                    {c.interventions && (
                      <p className="mt-1 text-sm text-ink/80">
                        <span className="font-medium">Intervenciones: </span>
                        {c.interventions}
                      </p>
                    )}
                    {c.observations && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-ink/80">
                        <span className="font-medium">Observaciones: </span>
                        {c.observations}
                      </p>
                    )}
                    {c.homework_tasks && (
                      <p className="mt-1 text-sm text-ink/80">
                        <span className="font-medium">Tareas: </span>
                        {c.homework_tasks}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink/50">Todavía no hay notas de sesión.</p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
