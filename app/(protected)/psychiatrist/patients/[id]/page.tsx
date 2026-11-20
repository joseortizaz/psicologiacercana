import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FollowupNoteView } from "@/components/FollowupNoteView";
import { formatAge } from "@/lib/age";
import { PsychiatricHistoryPanel } from "@/components/PsychiatricHistoryPanel";
import { AddFollowupNoteForm } from "@/components/AddFollowupNoteForm";
import { TeamMembersPanel } from "@/components/TeamMembersPanel";
import { AddDiagnosisForm } from "@/components/AddDiagnosisForm";
import { DiagnosesList } from "@/components/DiagnosesList";
import { AddPrescriptionForm } from "@/components/AddPrescriptionForm";
import { PrescriptionsList } from "@/components/PrescriptionsList";
import { EvaluationsList } from "@/components/EvaluationsList";
import { PrintExportRecordButton } from "@/components/PrintExportRecordButton";
import { ScheduleAppointmentForm } from "@/components/ScheduleAppointmentForm";
import { AppointmentStatusButtons } from "@/components/AppointmentStatusButtons";
import { EditPatientForm } from "@/components/EditPatientForm";
import { CARE_TEAM_ROLES } from "@/lib/roles";
import type {
  Appointment,
  ClinicalRecord,
  ClinicalRecordTeamMember,
  Consultation,
  EvaluationReport,
  Patient,
  PatientDiagnosis,
  PrescriptionRecord,
} from "@/lib/types";
import { TIME_ZONE } from "@/lib/datetime";

const CATEGORY_LABELS: Record<string, string> = {
  child: "Niño/a",
  adolescent: "Adolescente",
  adult: "Adulto",
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

const MODALITY_LABELS: Record<string, string> = {
  in_person: "Presencial",
  virtual: "Virtual",
  phone: "Telefónica",
};

function formatDateOnly(dateStr: string, options?: Intl.DateTimeFormatOptions) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("es-MX", options);
}

export default async function PsychiatristPatientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  // Sin filtro por primary_therapist_id/clinician: RLS (is_care_team_member)
  // ya se encarga de que esto solo devuelva algo si el psiquiatra autenticado
  // es miembro activo del equipo de ese expediente.
  const { data: clinicalRecord } = await supabase
    .from("clinical_records")
    .select(
      "id, organization_id, clinic_id, patient_id, primary_therapist_id, status, chief_complaint, diagnosis, diagnosis_hypothesis, therapeutic_objectives, treatment_plan, medications, allergies, history_sections, sensitive_history, discharge_date, discharge_summary, created_at, updated_at",
    )
    .eq("patient_id", patient.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ClinicalRecord>();

  const [
    { data: consultations },
    { data: teamMembers },
    { data: clinicStaff },
    { data: diagnoses },
    { data: prescriptions },
    { data: evaluations },
  ] = await Promise.all([
    clinicalRecord
      ? supabase
          .from("consultations")
          .select(
            "id, session_date, duration_minutes, modality, session_type, reason, objectives, interventions, techniques_used, note_content, observations, homework_tasks, status",
          )
          .eq("clinical_record_id", clinicalRecord.id)
          .order("session_date", { ascending: false })
          .returns<Consultation[]>()
      : Promise.resolve({ data: [] as Consultation[] }),
    clinicalRecord
      ? supabase
          .from("clinical_record_team_members")
          .select(
            "id, organization_id, clinical_record_id, clinician_id, role_in_team, active, added_by, added_at, updated_at, clinician:profiles!clinical_record_team_members_clinician_id_fkey(id, full_name, role, email)",
          )
          .eq("clinical_record_id", clinicalRecord.id)
          .eq("active", true)
          .returns<ClinicalRecordTeamMember[]>()
      : Promise.resolve({ data: [] as ClinicalRecordTeamMember[] }),
    supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("organization_id", patient.organization_id)
      .eq("clinic_id", patient.clinic_id)
      .eq("active", true)
      .in("role", CARE_TEAM_ROLES),
    clinicalRecord
      ? supabase
          .from("patient_diagnoses")
          .select(
            "id, organization_id, clinic_id, patient_id, clinical_record_id, diagnosis_code_id, type, status, diagnosed_by, diagnosed_at, notes, created_at, updated_at, diagnosis_code:diagnosis_codes(code, title), diagnosed_by_profile:profiles!patient_diagnoses_diagnosed_by_fkey(full_name)",
          )
          .eq("clinical_record_id", clinicalRecord.id)
          .order("diagnosed_at", { ascending: false })
          .returns<PatientDiagnosis[]>()
      : Promise.resolve({ data: [] as PatientDiagnosis[] }),
    clinicalRecord
      ? supabase
          .from("prescription_records")
          .select(
            "id, organization_id, clinic_id, patient_id, clinical_record_id, prescribing_clinician_id, issued_at, diagnosis_id, notes, created_at, updated_at, prescribing_clinician:profiles!prescription_records_prescribing_clinician_id_fkey(full_name), items:prescription_items(id, organization_id, clinic_id, clinical_record_id, prescription_record_id, medication_name, dosage, frequency, duration, instructions, is_controlled, strength, dosage_form, route, units_per_dose, units_per_day, created_at, updated_at)",
          )
          .eq("clinical_record_id", clinicalRecord.id)
          .order("issued_at", { ascending: false })
          .returns<PrescriptionRecord[]>()
      : Promise.resolve({ data: [] as PrescriptionRecord[] }),
    clinicalRecord
      ? supabase
          .from("evaluation_reports")
          .select(
            "id, organization_id, clinic_id, patient_id, clinical_record_id, administered_by, diagnosis_id, test_name, administered_at, score_summary, interpretation, attachment_path, status, finalized_at, created_by, created_at, updated_at, administered_by_profile:profiles!evaluation_reports_administered_by_fkey(full_name, role), diagnosis:patient_diagnoses!evaluation_reports_diagnosis_id_fkey(diagnosis_code:diagnosis_codes(code, title))",
          )
          .eq("clinical_record_id", clinicalRecord.id)
          .order("administered_at", { ascending: false })
          .returns<EvaluationReport[]>()
      : Promise.resolve({ data: [] as EvaluationReport[] }),
  ]);

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, start_time, end_time, modality, session_type, status")
    .eq("patient_id", patient.id)
    .eq("therapist_id", user!.id)
    .order("start_time", { ascending: false })
    .returns<Appointment[]>();

  const [{ data: prescriber }, { data: clinic }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, license_number, specialty")
      .eq("id", user!.id)
      .single<{ full_name: string; license_number: string | null; specialty: string | null }>(),
    supabase
      .from("clinics")
      .select("name, address, phone, email, logo_url")
      .eq("id", patient.clinic_id)
      .maybeSingle<{
        name: string;
        address: string | null;
        phone: string | null;
        email: string | null;
        logo_url: string | null;
      }>(),
  ]);

  const isOwnPatient = patient.primary_therapist_id === user!.id;

  const memberIds = new Set((teamMembers ?? []).map((m) => m.clinician_id));
  const candidates = (clinicStaff ?? []).filter((s) => !memberIds.has(s.id));

  const hasPrincipalDiagnosis = (diagnoses ?? []).some(
    (d) => d.type === "principal" && d.status !== "descartado",
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/psychiatrist/patients" className="text-sm text-ink/50 hover:text-ink">
          ← Pacientes
        </Link>
      </div>

      <section className="rounded-lg border border-line bg-white/60 p-6">
        <div className="flex items-center justify-between">
          <p className="font-display text-2xl text-deep">{patient.full_name}</p>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                patient.active ? "bg-sage/15 text-sage" : "bg-ink/10 text-ink/50"
              }`}
            >
              {patient.active ? "Activo" : "Inactivo"}
            </span>
            {clinicalRecord && (
              <PrintExportRecordButton
                data={{
                  patient,
                  clinicalRecord,
                  consultations: consultations ?? [],
                  diagnoses: diagnoses ?? [],
                  prescriptions: prescriptions ?? [],
                }}
              />
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-x-6 gap-y-2 text-sm text-ink/70 sm:grid-cols-3">
          <p>Categoría: {CATEGORY_LABELS[patient.category] ?? patient.category}</p>
          <p>Nacimiento: {formatDateOnly(patient.date_of_birth)} · Edad: {formatAge(patient.date_of_birth)}</p>
          <p>Correo: {patient.contact_email ?? "—"}</p>
          <p>Teléfono: {patient.contact_phone ?? "—"}</p>
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <EditPatientForm patient={patient} />
        </div>
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
                      {new Date(appt.start_time).toLocaleString("es-MX", { timeZone: TIME_ZONE,
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

      {!clinicalRecord && isOwnPatient ? (
        <section className="flex flex-col gap-4">
          <p className="font-display text-xl text-deep">Expediente clínico</p>
          <PsychiatricHistoryPanel
            organizationId={patient.organization_id}
            clinicId={patient.clinic_id}
            therapistId={user!.id}
            patientId={patient.id}
            patientCategory={patient.category}
            dateOfBirth={patient.date_of_birth}
            record={null}
          />
        </section>
      ) : !clinicalRecord ? (
        <p className="text-sm text-ink/50">
          Todavía no eres miembro del equipo de atención del expediente de este paciente.
        </p>
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <TeamMembersPanel
              clinicalRecordId={clinicalRecord.id}
              members={teamMembers ?? []}
              candidates={candidates}
            />
          </section>

          <section className="flex flex-col gap-4">
            <p className="font-display text-xl text-deep">Historia clínica y notas de sesión</p>

            <PsychiatricHistoryPanel
              organizationId={patient.organization_id}
              clinicId={patient.clinic_id}
              therapistId={user!.id}
              patientId={patient.id}
              patientCategory={patient.category}
              dateOfBirth={patient.date_of_birth}
              record={clinicalRecord}
            />

            <AddFollowupNoteForm
              organizationId={patient.organization_id}
              clinicId={patient.clinic_id}
              psychiatristId={user!.id}
              patientId={patient.id}
              clinicalRecordId={clinicalRecord.id}
              hasPrincipalDiagnosis={hasPrincipalDiagnosis}
            />

            {consultations && consultations.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {consultations.map((c) => (
                  <li key={c.id} className="rounded-lg border border-line bg-white/60 p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-wide text-ink/40">
                        {new Date(c.session_date).toLocaleDateString("es-MX", { timeZone: TIME_ZONE, dateStyle: "long" })}
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
                        <span className="font-medium">Motivo de control: </span>
                        {c.reason}
                      </p>
                    )}
                    <FollowupNoteView consultation={c} />
                    {c.observations && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-ink/80">
                        <span className="font-medium">Observaciones: </span>
                        {c.observations}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink/50">Todavía no hay notas de sesión.</p>
            )}
          </section>

          <section className="flex flex-col gap-4">
            <p className="font-display text-xl text-deep">Diagnósticos</p>

            <AddDiagnosisForm
              clinicId={patient.clinic_id}
              patientId={patient.id}
              clinicalRecordId={clinicalRecord.id}
              diagnosedBy={user!.id}
            />

            {!hasPrincipalDiagnosis && (
              <p role="alert" className="rounded-md border border-clay/40 bg-clay/5 px-3.5 py-2.5 text-sm text-clay">
                Falta el diagnóstico principal. Es obligatorio para finalizar notas de seguimiento.
              </p>
            )}
            <DiagnosesList diagnoses={diagnoses ?? []} />
          </section>

          <section className="flex flex-col gap-4">
            <p className="font-display text-xl text-deep">Recetas</p>

            <AddPrescriptionForm
              organizationId={patient.organization_id}
              clinicId={patient.clinic_id}
              patientId={patient.id}
              clinicalRecordId={clinicalRecord.id}
              prescribingClinicianId={user!.id}
            />

            <PrescriptionsList
              records={prescriptions ?? []}
              print={
                prescriber
                  ? {
                      currentUserId: user!.id,
                      context: { clinic: clinic ?? null, prescriber, patientName: patient.full_name },
                    }
                  : undefined
              }
            />
          </section>

          <section className="flex flex-col gap-4">
            <p className="font-display text-xl text-deep">Evaluaciones</p>
            <p className="-mt-2 text-sm text-ink/50">
              Solo el psicólogo tratante puede registrar evaluaciones.
            </p>
            <EvaluationsList evaluations={evaluations ?? []} />
          </section>
        </>
      )}
    </div>
  );
}
