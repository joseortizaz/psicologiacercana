import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppointmentStatusButtons } from "@/components/AppointmentStatusButtons";
import { ImportAppointmentsCsv } from "@/components/ImportAppointmentsCsv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import type { Clinic, Profile } from "@/lib/types";

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

export default async function OrgAdminAppointmentsPage({
  searchParams,
}: {
  searchParams: { clinic?: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, clinic_id")
    .eq("id", user!.id)
    .single<Profile>();

  const clinicFilter = searchParams.clinic;

  // RLS ya limita esto a la organización del usuario autenticado; org_admin
  // no tiene clinic_id propio, así que ve las citas de todas las clínicas.
  let appointmentsQuery = supabase
    .from("appointments")
    .select(
      "id, clinic_id, start_time, end_time, modality, status, patient:patients(id, full_name), therapist:profiles!appointments_therapist_id_fkey(full_name)",
    )
    .order("start_time", { ascending: true });

  if (clinicFilter) {
    appointmentsQuery = appointmentsQuery.eq("clinic_id", clinicFilter);
  }

  const [{ data: appointments }, { data: clinics }] = await Promise.all([
    appointmentsQuery,
    supabase
      .from("clinics")
      .select(
        "id, organization_id, name, address, phone, email, timezone, logo_url, primary_color, active, created_at, updated_at",
      )
      .order("name", { ascending: true })
      .returns<Clinic[]>(),
  ]);

  const clinicNameById = new Map((clinics ?? []).map((c) => [c.id, c.name]));

  const exportRows = (appointments ?? []).map((a) => {
    const patient = Array.isArray(a.patient) ? a.patient[0] : a.patient;
    const therapist = Array.isArray(a.therapist) ? a.therapist[0] : a.therapist;
    return {
      start_time: new Date(a.start_time).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }),
      patient: patient?.full_name ?? "",
      clinic: clinicNameById.get(a.clinic_id) ?? "",
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
        <p className="font-display text-2xl text-deep">Citas</p>
        <div className="flex gap-3">
          <ExportCsvButton
            rows={exportRows}
            columns={[
              { key: "start_time", label: "Fecha y hora" },
              { key: "patient", label: "Paciente" },
              { key: "clinic", label: "Sucursal" },
              { key: "therapist", label: "Terapeuta" },
              { key: "modality", label: "Modalidad" },
              { key: "status", label: "Estado" },
            ]}
            filename="citas.csv"
            auditTable="appointments"
          />
          {clinics && clinics.length > 0 && (
            <ImportAppointmentsCsv
              organizationId={profile!.organization_id!}
              assignableClinics={clinics.map((c) => ({ id: c.id, name: c.name }))}
            />
          )}
        </div>
      </div>

      {clinics && clinics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Link
            href="/org-admin/appointments"
            className={`rounded-full border px-4 py-1.5 text-sm transition ${
              !clinicFilter
                ? "border-deep bg-deep text-paper"
                : "border-line bg-white/60 text-ink/70 hover:border-deep/40"
            }`}
          >
            Todas las sucursales
          </Link>
          {clinics.map((c) => (
            <Link
              key={c.id}
              href={`/org-admin/appointments?clinic=${c.id}`}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${
                clinicFilter === c.id
                  ? "border-deep bg-deep text-paper"
                  : "border-line bg-white/60 text-ink/70 hover:border-deep/40"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

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
                      <th className="px-5 py-3 font-medium">Sucursal</th>
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
                                href={`/org-admin/patients/${patient.id}`}
                                className="hover:underline"
                              >
                                {patient.full_name}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-ink/70">
                            {clinicNameById.get(appt.clinic_id) ?? "—"}
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
        <p className="text-sm text-ink/50">
          {clinicFilter
            ? "No hay citas agendadas en esta sucursal."
            : "No hay citas agendadas en la organización."}
        </p>
      )}
    </div>
  );
}
