import type { PrescriptionRecord } from "@/lib/types";

export function PrescriptionsList({ records }: { records: PrescriptionRecord[] }) {
  if (records.length === 0) {
    return <p className="text-sm text-ink/50">Todavía no hay recetas registradas.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {records.map((r) => (
        <li key={r.id} className="rounded-lg border border-line bg-white/60 p-5">
          <p className="text-xs uppercase tracking-wide text-ink/40">
            {new Date(`${r.issued_at}T00:00:00`).toLocaleDateString("es-MX", { dateStyle: "long" })}
            {r.prescribing_clinician?.full_name ? ` · ${r.prescribing_clinician.full_name}` : ""}
          </p>

          {r.items && r.items.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {r.items.map((item) => (
                <li key={item.id} className="text-sm text-ink/80">
                  <span className="font-medium">{item.medication_name}</span> · {item.dosage} ·{" "}
                  {item.frequency}
                  {item.duration ? ` · ${item.duration}` : ""}
                  {item.is_controlled && (
                    <span className="ml-2 rounded-full bg-clay/10 px-2 py-0.5 text-xs text-clay">
                      Controlado
                    </span>
                  )}
                  {item.instructions && (
                    <p className="text-xs text-ink/50">{item.instructions}</p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {r.notes && <p className="mt-2 text-sm text-ink/80">{r.notes}</p>}
        </li>
      ))}
    </ul>
  );
}
