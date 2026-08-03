import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

export default async function SupervisorHomePage() {
  const supabase = createClient();

  // RLS limita todas estas consultas a la clínica del supervisor autenticado
  // (solo lectura: supervisor no tiene INSERT/UPDATE en ninguna tabla clínica).
  const { data: upcoming } = await supabase
    .from("appointments")
    .select(
      "id, start_time, status, patient:patients(id, full_name), therapist:profiles!appointments_therapist_id_fkey(full_name)",
    )
    .in("status", ["scheduled", "confirmed"])
    .gte("start_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .limit(8);

  const { count: patientCount } = await supabase
    .from("patients")
    .select("id", { count: "exact", head: true })
    .eq("active", true);

  const { count: draftCount } = await supabase
    .from("consultations")
    .select("id", { count: "exact", head: true })
    .eq("status", "draft");

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-white/60 p-6">
          <p className="text-xs uppercase tracking-wide text-ink/40">Pacientes activos</p>
          <p className="mt-2 font-display text-3xl text-deep">{patientCount ?? 0}</p>
          <Link
            href="/supervisor/patients"
            className="mt-3 inline-block text-sm font-medium text-deep underline decoration-deep/30 underline-offset-2"
          >
            Ver pacientes
          </Link>
        </div>
        <div className="rounded-lg border border-line bg-white/60 p-6">
          <p className="text-xs uppercase tracking-wide text-ink/40">Próximas citas</p>
          <p className="mt-2 font-display text-3xl text-deep">{upcoming?.length ?? 0}</p>
          <Link
            href="/supervisor/appointments"
            className="mt-3 inline-block text-sm font-medium text-deep underline decoration-deep/30 underline-offset-2"
          >
            Ver agenda
          </Link>
        </div>
        <div className="rounded-lg border border-line bg-white/60 p-6">
          <p className="text-xs uppercase tracking-wide text-ink/40">Notas en borrador</p>
          <p className="mt-2 font-display text-3xl text-deep">{draftCount ?? 0}</p>
          <p className="mt-3 text-sm text-ink/50">Sin firmar por el terapeuta todavía</p>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <p className="font-display text-2xl text-deep">Próximas citas de la clínica</p>

        {upcoming && upcoming.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-line bg-white/60">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-ink/40">
                  <th className="px-5 py-3 font-medium">Paciente</th>
                  <th className="px-5 py-3 font-medium">Terapeuta</th>
                  <th className="px-5 py-3 font-medium">Fecha</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((appt) => {
                  const patient = Array.isArray(appt.patient) ? appt.patient[0] : appt.patient;
                  const therapist = Array.isArray(appt.therapist)
                    ? appt.therapist[0]
                    : appt.therapist;
                  return (
                    <tr key={appt.id} className="border-b border-line last:border-0">
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
                        {new Date(appt.start_time).toLocaleString("es-MX", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
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
          <p className="text-sm text-ink/50">No hay citas próximas agendadas en la clínica.</p>
        )}
      </section>
    </div>
  );
}
