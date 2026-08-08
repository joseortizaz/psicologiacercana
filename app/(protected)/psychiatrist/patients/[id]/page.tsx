import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClinicalRecordPanel } from "@/components/ClinicalRecordPanel";
import { AddConsultationForm } from "@/components/AddConsultationForm";
import { TeamMembersPanel } from "@/components/TeamMembersPanel";
import { AddDiagnosisForm } from "@/components/AddDiagnosisForm";
import { DiagnosesList } from "@/components/DiagnosesList";
import { AddPrescriptionForm } from "@/components/AddPrescriptionForm";
import { PrescriptionsList } from "@/components/PrescriptionsList";
import { CARE_TEAM_ROLES } from "@/lib/roles";
import type {
  ClinicalRecord,
  ClinicalRecordTeamMember,
  Consultation,
  Patient,
  PatientDiagnosis,
  PrescriptionRecord,
} from "@/lib/types";

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
      "id, organization_id, clinic_id, full_name, date_of_birth, category, contact_email, contact_phone, active, primary_therapist_id",
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
  ] = await Promise.all([
    clinicalRecord
      ? supabase
          .from("consultations")
          .select(
            "id, session_date, duration_minutes, modality, session_type, reason, objectives, interventions, techniques_used, observations, homework_tasks, status",
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
            "id, organization_id, clinic_id, patient_id, clinical_record_id, prescribing_clinician_id, issued_at, diagnosis_id, notes, created_at, updated_at, prescribing_clinician:profiles!prescription_records_prescribing_clinician_id_fkey(full_name), items:prescription_items(id, organization_id, clinic_id, clinical_record_id, prescription_record_id, medication_name, dosage, frequency, duration, instructions, is_controlled, created_at, updated_at)",
          )
          .eq("clinical_record_id", clinicalRecord.id)
          .order("issued_at", { ascending: false })
          .returns<PrescriptionRecord[]>()
      : Promise.resolve({ data: [] as PrescriptionRecord[] }),
  ]);

  const memberIds = new Set((teamMembers ?? []).map((m) => m.clinician_id));
  const candidates = (clinicStaff ?? []).filter((s) => !memberIds.has(s.id));

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
          <p>Correo: {patient.contact_email ?? "—"}</p>
          <p>Teléfono: {patient.contact_phone ?? "—"}</p>
        </div>
      </section>

      {!clinicalRecord ? (
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
            <p className="font-display text-xl text-deep">Expediente clínico y notas de sesión</p>

            <ClinicalRecordPanel
              organizationId={patient.organization_id}
              clinicId={patient.clinic_id}
              therapistId={user!.id}
              patientId={patient.id}
              record={clinicalRecord}
            />

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

            <PrescriptionsList records={prescriptions ?? []} />
          </section>
        </>
      )}
    </div>
  );
}
