import type { ClinicalRecord } from "@/lib/types";
import {
  MEDICATION_CATEGORY_LABELS,
  SUBSTANCE_LABELS,
  medicationRows,
} from "@/lib/psychiatric-history";

// Vista de solo lectura de las tablas de la historia clínica psiquiátrica
// (medicamentos y hábitos tóxicos). Sin estado: sirve en páginas de servidor.
export function HistoryTables({ record }: { record: ClinicalRecord }) {
  const categories = ["psychiatric", "non_psychiatric"] as const;
  const habits = record.sensitive_history?.substance_habits ?? [];
  const hasMeds = categories.some((c) => medicationRows(record.history_sections, c).length > 0);

  if (!hasMeds && habits.length === 0) return null;

  return (
    <>
      {hasMeds && (
        <div className="rounded-lg border border-line bg-white/60 p-6">
          {categories.map((category) => {
            const rows = medicationRows(record.history_sections, category);
            if (rows.length === 0) return null;
            return (
              <div key={category} className="mb-4 last:mb-0">
                <p className="font-display text-base text-deep">
                  {MEDICATION_CATEGORY_LABELS[category]}
                </p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-line text-xs uppercase tracking-wide text-ink/40">
                        <th className="py-2 pr-3 font-medium">Medicamento</th>
                        <th className="py-2 pr-3 font-medium">Dosis / vía</th>
                        <th className="py-2 pr-3 font-medium">Inicio</th>
                        <th className="py-2 pr-3 font-medium">Finalización</th>
                        <th className="py-2 pr-3 font-medium">Uso actual</th>
                        <th className="py-2 font-medium">Observaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className="border-b border-line last:border-0 text-ink/70">
                          <td className="py-2 pr-3 font-medium text-ink">{r.name}</td>
                          <td className="py-2 pr-3">{r.dose_route || "—"}</td>
                          <td className="py-2 pr-3">{r.start || "—"}</td>
                          <td className="py-2 pr-3">{r.end || "—"}</td>
                          <td className="py-2 pr-3">{r.current ? "Sí" : "No"}</td>
                          <td className="py-2">{r.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {habits.length > 0 && (
        <div className="rounded-lg border border-clay/30 bg-clay/5 p-6">
          <p className="font-display text-base text-deep">Hábitos tóxicos</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-ink/40">
                  <th className="py-2 pr-3 font-medium">Sustancia</th>
                  <th className="py-2 pr-3 font-medium">Consume</th>
                  <th className="py-2 pr-3 font-medium">Tiempo de consumo</th>
                  <th className="py-2 pr-3 font-medium">Abandono</th>
                  <th className="py-2 font-medium">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {habits.map((h) => (
                  <tr key={h.substance} className="border-b border-line last:border-0 text-ink/70">
                    <td className="py-2 pr-3 font-medium text-ink">{SUBSTANCE_LABELS[h.substance]}</td>
                    <td className="py-2 pr-3">{h.uses ? "Sí" : "No"}</td>
                    <td className="py-2 pr-3">{h.duration || "—"}</td>
                    <td className="py-2 pr-3">{h.quit || "—"}</td>
                    <td className="py-2">{h.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
