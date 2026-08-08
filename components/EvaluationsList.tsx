import { EvaluationAttachmentLink } from "@/components/EvaluationAttachmentLink";
import type { EvaluationReport } from "@/lib/types";

function formatDateOnly(dateStr: string, options?: Intl.DateTimeFormatOptions) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("es-MX", options);
}

export function EvaluationsList({ evaluations }: { evaluations: EvaluationReport[] }) {
  if (evaluations.length === 0) {
    return <p className="text-sm text-ink/50">Todavía no hay evaluaciones registradas.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {evaluations.map((ev) => (
        <li key={ev.id} className="rounded-lg border border-line bg-white/60 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-ink">{ev.test_name}</p>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                ev.status === "finalized" ? "bg-sage/15 text-sage" : "bg-ink/10 text-ink/50"
              }`}
            >
              {ev.status === "finalized" ? "Finalizada" : "Borrador"}
            </span>
          </div>
          <p className="mt-1 text-xs uppercase tracking-wide text-ink/40">
            {formatDateOnly(ev.administered_at, { dateStyle: "long" })}
            {ev.administered_by_profile?.full_name ? ` · ${ev.administered_by_profile.full_name}` : ""}
            {ev.diagnosis?.diagnosis_code?.title ? ` · ${ev.diagnosis.diagnosis_code.title}` : ""}
          </p>
          {ev.score_summary && (
            <p className="mt-2 text-sm text-ink/80">
              <span className="font-medium">Resultado: </span>
              {ev.score_summary}
            </p>
          )}
          {ev.interpretation && (
            <p className="mt-1 whitespace-pre-wrap text-sm text-ink/80">
              <span className="font-medium">Interpretación: </span>
              {ev.interpretation}
            </p>
          )}
          {ev.attachment_path && <EvaluationAttachmentLink path={ev.attachment_path} />}
        </li>
      ))}
    </ul>
  );
}
