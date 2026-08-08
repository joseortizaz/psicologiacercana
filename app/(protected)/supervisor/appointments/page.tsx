import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ExportCsvButton } from "@/components/ExportCsvButton";

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

export default async function SupervisorAppointmentsPage() {
  const supabase = createClient();

  // RLS limita esto a las citas de la clínica del supervisor autenticado.
  const { data: appointments } = await supabase
    .from("appointments")
    .select(
      "id, start_time, end_time, modality, status, patient:patients(id, full_name), therapist:profiles!appointments_therapist_id_fkey(full_name)",
    )
    .order("start_time", { ascending: true });

  const exportRows = (appointments ?? []).map((a) => {
    const patient = Array.isArray(a.patient) ? a.patient[0] : a.patient;
    const therapist = Array.isArray(a.therapist) ? a.therapist[0] : a.therapist;
    return {
      start_time: new Date(a.start_time).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }),
      patient: patient?.full_name ?? "",
      therapist: therapist?.full_name ?? "",
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
        <div>
          <p className="font-display text-2xl text-deep">Citas de la clínica</p>
          <p className="mt-1 text-sm text-ink/50">Vista de solo lectura.</p>
        </div>
        <ExportCsvButton
          rows={exportRows}
          columns={[
            { key: "start_time", label: "Fecha y hora" },
            { key: "patient", label: "Paciente" },
            { key: "therapist", label: "Terapeuta" },
            { key: "modality", label: "Modalidad" },
            { key: "status", label: "Estado" },
          ]}
          filename="citas.csv"
          auditTable="appointments"
        />
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
                      <th className="px-5 py-3 font-medium">Terapeuta</th>
                      <th className="px-5 py-3 font-medium">Modalidad</th>
                      <th className="px-5 py-3 font-medium">Estado</th>
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
                                href={`/supervisor/patients/${patient.id}`}
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
