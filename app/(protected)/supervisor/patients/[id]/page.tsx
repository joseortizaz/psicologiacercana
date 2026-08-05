import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  Appointment,
  ClinicalHistorySections,
  ClinicalRecord,
  ClinicalSensitiveHistory,
  Consultation,
  Patient,
} from "@/lib/types";

const HISTORY_SECTION_FIELDS: { key: keyof ClinicalHistorySections; label: string }[] = [
  { key: "personal_history", label: "Historia personal" },
  { key: "family_history", label: "Antecedentes familiares" },
  { key: "medical_history", label: "Antecedentes médicos" },
  { key: "psychiatric_history", label: "Antecedentes psicológicos/psiquiátricos" },
  { key: "social_history", label: "Historia social" },
  { key: "mental_status_exam", label: "Examen del estado mental" },
];

const SENSITIVE_SECTION_FIELDS: { key: keyof ClinicalSensitiveHistory; label: string }[] = [
  { key: "substance_use", label: "Consumo de sustancias" },
  { key: "trauma_history", label: "Historia de trauma o abuso" },
  { key: "risk_history", label: "Riesgo (ideación/intento suicida, autolesión)" },
  { key: "legal_history", label: "Historia legal" },
];

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

const CASE_STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  in_treatment: "En tratamiento",
  discharged: "Alta",
  suspended: "Suspendido",
};

// Ver nota equivalente en el detalle de paciente del panel de terapeuta.
function formatDateOnly(dateStr: string, options?: Intl.DateTimeFormatOptions) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("es-MX", options);
}

export default async function SupervisorPatientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

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

  const [{ data: appointments }, { data: clinicalRecord }, { data: therapist }] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, start_time, end_time, modality, session_type, status, therapist:profiles!appointments_therapist_id_fkey(full_name)",
      )
      .eq("patient_id", patient.id)
      .order("start_time", { ascending: false })
      .returns<(Appointment & { therapist: { full_name: string } | { full_name: string }[] | null })[]>(),
    // clinical_records tiene UNIQUE(patient_id): a lo más un expediente por
    // paciente en todo el sistema, así que no hace falta filtrar por terapeuta.
    supabase
      .from("clinical_records")
      .select(
        "id, organization_id, clinic_id, patient_id, primary_therapist_id, status, chief_complaint, diagnosis, diagnosis_hypothesis, therapeutic_objectives, treatment_plan, medications, allergies, history_sections, sensitive_history, discharge_date, discharge_summary, created_at, updated_at",
      )
      .eq("patient_id", patient.id)
      .maybeSingle<ClinicalRecord>(),
    patient.primary_therapist_id
      ? supabase.from("profiles").select("full_name").eq("id", patient.primary_therapist_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const { data: consultations } = clinicalRecord
    ? await supabase
        .from("consultations")
        .select(
          "id, session_date, duration_minutes, modality, session_type, reason, objectives, interventions, observations, homework_tasks, status, therapist:profiles!consultations_therapist_id_fkey(full_name)",
        )
        .eq("clinical_record_id", clinicalRecord.id)
        .order("session_date", { ascending: false })
        .returns<(Consultation & { therapist: { full_name: string } | { full_name: string }[] | null })[]>()
    : { data: [] as (Consultation & { therapist: { full_name: string } | { full_name: string }[] | null })[] };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/supervisor/patients" className="text-sm text-ink/50 hover:text-ink">
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
          <p>Terapeuta: {therapist?.full_name ?? "Sin asignar"}</p>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <p className="font-display text-xl text-deep">Citas</p>

        {appointments && appointments.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-line bg-white/60">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-ink/40">
                  <th className="px-5 py-3 font-medium">Fecha</th>
                  <th className="px-5 py-3 font-medium">Terapeuta</th>
                  <th className="px-5 py-3 font-medium">Modalidad</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appt) => {
                  const apptTherapist = Array.isArray(appt.therapist) ? appt.therapist[0] : appt.therapist;
                  return (
                    <tr key={appt.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3.5 text-ink/70">
                        {new Date(appt.start_time).toLocaleString("es-MX", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-5 py-3.5 text-ink/70">{apptTherapist?.full_name ?? "—"}</td>
                      <td className="px-5 py-3.5 text-ink/70">
                        {MODALITY_LABELS[appt.modality] ?? appt.modality}
                      </td>
                      <td className="px-5 py-3.5 text-ink/70">
                        {STATUS_LABELS[appt.status] ?? appt.status}
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

      <section className="flex flex-col gap-4">
        <p className="font-display text-xl text-deep">Expediente clínico y notas de sesión</p>
        <p className="-mt-2 text-sm text-ink/50">Vista de solo lectura.</p>

        {clinicalRecord ? (
          <>
            {clinicalRecord.status === "discharged" && (
              <div className="rounded-lg border border-sage/40 bg-sage/10 p-6">
                <p className="font-display text-lg text-deep">
                  Alta
                  {clinicalRecord.discharge_date &&
                    ` · ${new Date(`${clinicalRecord.discharge_date}T00:00:00`).toLocaleDateString("es-MX", { dateStyle: "long" })}`}
                </p>
                {clinicalRecord.discharge_summary && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink/80">
                    {clinicalRecord.discharge_summary}
                  </p>
                )}
              </div>
            )}

            <div className="rounded-lg border border-line bg-white/60 p-6">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide text-ink/40">
                  {CASE_STATUS_LABELS[clinicalRecord.status] ?? clinicalRecord.status}
                </p>
              </div>
              <div className="mt-3 flex flex-col gap-2 text-sm text-ink/80">
                {clinicalRecord.chief_complaint && (
                  <p>
                    <span className="font-medium">Motivo de consulta: </span>
                    {clinicalRecord.chief_complaint}
                  </p>
                )}
                {clinicalRecord.diagnosis_hypothesis && (
                  <p>
                    <span className="font-medium">Hipótesis diagnóstica: </span>
                    {clinicalRecord.diagnosis_hypothesis}
                  </p>
                )}
                {clinicalRecord.diagnosis && (
                  <p>
                    <span className="font-medium">Diagnóstico: </span>
                    {clinicalRecord.diagnosis}
                  </p>
                )}
                {clinicalRecord.therapeutic_objectives && (
                  <p>
                    <span className="font-medium">Objetivos terapéuticos: </span>
                    {clinicalRecord.therapeutic_objectives}
                  </p>
                )}
                {clinicalRecord.treatment_plan && (
                  <p>
                    <span className="font-medium">Plan de tratamiento: </span>
                    {clinicalRecord.treatment_plan}
                  </p>
                )}
              </div>

              {(clinicalRecord.medications?.length > 0 || clinicalRecord.allergies?.length > 0) && (
                <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
                  {clinicalRecord.medications?.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-ink/40">Medicamentos</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {clinicalRecord.medications.map((m) => (
                          <span
                            key={m}
                            className="rounded-full bg-ink/5 px-2.5 py-1 text-xs text-ink/70"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {clinicalRecord.allergies?.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-ink/40">Alergias</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {clinicalRecord.allergies.map((a) => (
                          <span
                            key={a}
                            className="rounded-full bg-clay/10 px-2.5 py-1 text-xs text-clay"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {HISTORY_SECTION_FIELDS.some((f) => clinicalRecord.history_sections?.[f.key]) && (
              <div className="rounded-lg border border-line bg-white/60 p-6">
                <p className="font-display text-base text-deep">Historia clínica estructurada</p>
                <div className="mt-3 flex flex-col gap-3 text-sm text-ink/70">
                  {HISTORY_SECTION_FIELDS.filter((f) => clinicalRecord.history_sections?.[f.key]).map(
                    (f) => (
                      <p key={f.key}>
                        <span className="font-medium text-ink/80">{f.label}: </span>
                        {clinicalRecord.history_sections[f.key]}
                      </p>
                    ),
                  )}
                </div>
              </div>
            )}

            {SENSITIVE_SECTION_FIELDS.some((f) => clinicalRecord.sensitive_history?.[f.key]) && (
              <div className="rounded-lg border border-clay/30 bg-clay/5 p-6">
                <p className="font-display text-base text-deep">Información sensible</p>
                <div className="mt-3 flex flex-col gap-3 text-sm text-ink/70">
                  {SENSITIVE_SECTION_FIELDS.filter(
                    (f) => clinicalRecord.sensitive_history?.[f.key],
                  ).map((f) => (
                    <p key={f.key}>
                      <span className="font-medium text-ink/80">{f.label}: </span>
                      {clinicalRecord.sensitive_history[f.key]}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-ink/50">Este paciente todavía no tiene expediente clínico.</p>
        )}

        {consultations && consultations.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {consultations.map((c) => {
              const cTherapist = Array.isArray(c.therapist) ? c.therapist[0] : c.therapist;
              return (
                <li key={c.id} className="rounded-lg border border-line bg-white/60 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-wide text-ink/40">
                      {new Date(c.session_date).toLocaleDateString("es-MX", { dateStyle: "long" })}
                      {" · "}
                      {MODALITY_LABELS[c.modality] ?? c.modality}
                      {cTherapist ? ` · ${cTherapist.full_name}` : ""}
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        c.status === "finalized" ? "bg-sage/15 text-sage" : "bg-ink/10 text-ink/50"
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
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-ink/50">Todavía no hay notas de sesión.</p>
        )}
      </section>
    </div>
  );
}
