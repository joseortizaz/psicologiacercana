import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppointmentStatusButtons } from "@/components/AppointmentStatusButtons";

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

export default async function AssistantAppointmentsPage() {
  const supabase = createClient();

  // RLS limita esto a las citas de la clínica del usuario autenticado.
  const { data: appointments } = await supabase
    .from("appointments")
    .select(
      "id, start_time, end_time, modality, status, patient:patients(id, full_name), therapist:profiles!appointments_therapist_id_fkey(full_name)",
    )
    .order("start_time", { ascending: true });

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
      <p className="font-display text-2xl text-deep">Citas de la clínica</p>

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
                      <th className="px-5 py-3 font-medium">Terapeuta</th>
                      <th className="px-5 py-3 font-medium">Modalidad</th>
                      <th className="px-5 py-3 font-medium">Estado</th>
                      <th className="px-5 py-3 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayAppointments!.map((appt) => {
                      const patient = Array.isArray(appt.patient) ? appt.patient[0] : appt.patient;
                      const therapist = Array.isArray(appt.therapist)
                        ? appt.therapist[0]
                        : appt.therapist;
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
                                href={`/assistant/patients/${patient.id}`}
                                className="hover:underline"
                              >
                                {patient.full_name}
                              </Link>
                            ) : (
                              "—"
                            )}
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
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink/50">No hay citas agendadas en la clínica.</p>
      )}
    </div>
  );
}
