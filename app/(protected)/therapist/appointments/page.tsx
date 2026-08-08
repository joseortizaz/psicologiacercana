import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppointmentStatusButtons } from "@/components/AppointmentStatusButtons";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { ImportAppointmentsCsv } from "@/components/ImportAppointmentsCsv";
import type { Profile } from "@/lib/types";

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

export default async function TherapistAppointmentsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, clinic_id")
    .eq("id", user!.id)
    .single<Profile>();

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, start_time, end_time, modality, status, patient:patients(id, full_name)")
    .eq("therapist_id", user!.id)
    .order("start_time", { ascending: true });

  const exportRows = (appointments ?? []).map((a) => {
    const patient = Array.isArray(a.patient) ? a.patient[0] : a.patient;
    return {
      start_time: new Date(a.start_time).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }),
      patient: patient?.full_name ?? "",
      modality: MODALITY_LABELS[a.modality] ?? a.modality,
      status: STATUS_LABELS[a.status] ?? a.status,
    };
  });

  const groups = new Map<string, typeof appointments>();
  for (const appt of appointments ?? []) {
    const dayKey = new Date(appt.start_time).toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    if (!groups.has(dayKey)) groups.set(dayKey, []);
    groups.get(dayKey)!.push(appt);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="font-display text-2xl text-deep">Citas</p>
        <div className="flex gap-3">
          <ExportCsvButton
            rows={exportRows}
            columns={[
              { key: "start_time", label: "Fecha y hora" },
              { key: "patient", label: "Paciente" },
              { key: "modality", label: "Modalidad" },
              { key: "status", label: "Estado" },
            ]}
            filename="citas.csv"
            auditTable="appointments"
          />
          <ImportAppointmentsCsv
            organizationId={profile!.organization_id!}
            clinicId={profile!.clinic_id!}
            therapistId={user!.id}
          />
        </div>
      </div>

      {groups.size > 0 ? (
        <div className="flex flex-col gap-6">
          {Array.from(groups.entries()).map(([day, dayAppointments]) => (
            <div key={day} className="flex flex-col gap-3">
              <p className="text-sm font-medium capitalize text-ink/60">{day}</p>
              <div className="overflow-hidden rounded-lg border border-line bg-white/60">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs uppercase tracking-wide text-ink/40">
                      <th className="px-5 py-3 font-medium">Hora</th>
                      <th className="px-5 py-3 font-medium">Paciente</th>
                      <th className="px-5 py-3 font-medium">Modalidad</th>
                      <th className="px-5 py-3 font-medium">Estado</th>
                      <th className="px-5 py-3 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayAppointments!.map((appt) => {
                      const patient = Array.isArray(appt.patient) ? appt.patient[0] : appt.patient;
                      return (
                        <tr key={appt.id} className="border-b border-line last:border-0">
                          <td className="px-5 py-3.5 text-ink/70">
                            {new Date(appt.start_time).toLocaleTimeString("es-MX", {
                              timeStyle: "short",
                            })}
                          </td>
                          <td className="px-5 py-3.5 font-medium text-ink">
                            {patient ? (
                              <Link
                                href={`/therapist/patients/${patient.id}`}
                                className="hover:underline"
                              >
                                {patient.full_name}
                              </Link>
                            ) : (
                              "—"
                            )}
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink/50">No tienes citas agendadas. Agenda una desde el perfil de un paciente.</p>
      )}
    </div>
  );
}
