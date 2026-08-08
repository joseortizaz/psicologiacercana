import { ExportCsvButton } from "@/components/ExportCsvButton";
import type { PatientDiagnosis } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  principal: "Principal",
  secundario: "Secundario",
};

const STATUS_LABELS: Record<string, string> = {
  activo: "Activo",
  en_remisión: "En remisión",
  descartado: "Descartado",
};

export function DiagnosesList({ diagnoses }: { diagnoses: PatientDiagnosis[] }) {
  if (diagnoses.length === 0) {
    return <p className="text-sm text-ink/50">Todavía no hay diagnósticos registrados.</p>;
  }

  const exportRows = diagnoses.map((d) => ({
    code: d.diagnosis_code?.code ?? "",
    title: d.diagnosis_code?.title ?? "",
    type: TYPE_LABELS[d.type] ?? d.type,
    status: STATUS_LABELS[d.status] ?? d.status,
    diagnosed_at: new Date(d.diagnosed_at).toLocaleDateString("es-MX", { dateStyle: "medium" }),
    diagnosed_by: d.diagnosed_by_profile?.full_name ?? "",
    notes: d.notes ?? "",
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <ExportCsvButton
          rows={exportRows}
          columns={[
            { key: "code", label: "Código" },
            { key: "title", label: "Diagnóstico" },
            { key: "type", label: "Tipo" },
            { key: "status", label: "Estado" },
            { key: "diagnosed_at", label: "Fecha" },
            { key: "diagnosed_by", label: "Diagnosticado por" },
            { key: "notes", label: "Notas" },
          ]}
          filename="diagnosticos.csv"
          auditTable="patient_diagnoses"
        />
      </div>
      <ul className="flex flex-col gap-3">
        {diagnoses.map((d) => (
        <li key={d.id} className="rounded-lg border border-line bg-white/60 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-ink">
              {d.diagnosis_code?.code} · {d.diagnosis_code?.title ?? "—"}
            </p>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                d.status === "activo" ? "bg-sage/15 text-sage" : "bg-ink/10 text-ink/50"
              }`}
            >
              {STATUS_LABELS[d.status] ?? d.status}
            </span>
          </div>
          <p className="mt-1 text-xs uppercase tracking-wide text-ink/40">
            {TYPE_LABELS[d.type] ?? d.type}
            {" · "}
            {new Date(d.diagnosed_at).toLocaleDateString("es-MX", { dateStyle: "long" })}
            {d.diagnosed_by_profile?.full_name ? ` · ${d.diagnosed_by_profile.full_name}` : ""}
          </p>
          {d.notes && <p className="mt-2 text-sm text-ink/80">{d.notes}</p>}
        </li>
      ))}
      </ul>
    </div>
  );
}
