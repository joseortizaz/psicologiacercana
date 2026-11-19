import { followupEntries } from "@/lib/followup-note";
import type { Consultation } from "@/lib/types";

// Vista de solo lectura de la nota de seguimiento psiquiátrico. Sin estado, así
// que sirve en páginas de servidor. La evaluación de riesgo se resalta.
export function FollowupNoteView({ consultation }: { consultation: Pick<Consultation, "note_content"> }) {
  const entries = followupEntries(consultation);
  if (entries.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-2 text-sm text-ink/80">
      {entries.map((e) =>
        e.key === "risk_assessment" ? (
          <p key={e.key} className="whitespace-pre-wrap rounded-md border border-clay/30 bg-clay/5 p-2.5">
            <span className="font-medium text-clay">{e.label}: </span>
            {e.value}
          </p>
        ) : (
          <p key={e.key} className="whitespace-pre-wrap">
            <span className="font-medium">{e.label}: </span>
            {e.value}
          </p>
        ),
      )}
    </div>
  );
}
