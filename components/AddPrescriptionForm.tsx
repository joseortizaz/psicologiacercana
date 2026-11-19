"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const DOSAGE_FORMS = ["Tableta", "Cápsula", "Jarabe", "Solución oral", "Gotas", "Inyectable", "Parche", "Crema", "Supositorio"];
const ROUTES = ["Oral", "Sublingual", "Intramuscular", "Intravenosa", "Subcutánea", "Tópica", "Rectal", "Inhalatoria"];

interface ItemDraft {
  medication_name: string;
  strength: string;
  dosage_form: string;
  route: string;
  units_per_dose: string;
  frequency: string;
  units_per_day: string;
  duration: string;
  instructions: string;
  is_controlled: boolean;
}

const EMPTY_ITEM: ItemDraft = {
  medication_name: "",
  strength: "",
  dosage_form: "",
  route: "",
  units_per_dose: "",
  frequency: "",
  units_per_day: "",
  duration: "",
  instructions: "",
  is_controlled: false,
};

const inputClass =
  "rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep";

export function AddPrescriptionForm({
  organizationId,
  clinicId,
  patientId,
  clinicalRecordId,
  prescribingClinicianId,
}: {
  organizationId: string;
  clinicId: string;
  patientId: string;
  clinicalRecordId: string;
  prescribingClinicianId: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [items, setItems] = useState<ItemDraft[]>([{ ...EMPTY_ITEM }]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const filled = items.filter((it) => it.medication_name.trim());
    if (filled.length === 0) {
      setError("Agrega al menos un medicamento.");
      return;
    }
    // La receta impresa exige estos datos (Decreto 665-12, art. 7). Un
    // medicamento controlado solo se registra como historial interno (no se
    // imprime), así que a ese no se le exige el detalle completo.
    const incomplete = filled.find(
      (it) =>
        !it.is_controlled &&
        !(
          it.strength.trim() &&
          it.dosage_form.trim() &&
          it.route.trim() &&
          it.units_per_dose.trim() &&
          it.frequency.trim() &&
          it.units_per_day.trim() &&
          it.duration.trim()
        ),
    );
    if (incomplete) {
      setError(
        `Completa los datos de "${incomplete.medication_name}": concentración, forma, vía, cantidad por toma, frecuencia, cantidad por día y duración.`,
      );
      return;
    }
    const validItems = filled;

    setLoading(true);
    setError(null);

    const { data: record, error: recordError } = await supabase
      .from("prescription_records")
      .insert({
        organization_id: organizationId,
        clinic_id: clinicId,
        patient_id: patientId,
        clinical_record_id: clinicalRecordId,
        prescribing_clinician_id: prescribingClinicianId,
        notes: notes || null,
      })
      .select()
      .single();

    if (recordError || !record) {
      setLoading(false);
      setError(recordError?.message ?? "No se pudo crear el registro de receta.");
      return;
    }

    const { error: itemsError } = await supabase.from("prescription_items").insert(
      validItems.map((it) => ({
        prescription_record_id: record.id,
        medication_name: it.medication_name,
        // `dosage` es obligatorio en la tabla y lo usan las vistas anteriores:
        // se arma con la cantidad por toma y la concentración.
        dosage: [it.units_per_dose.trim(), it.strength.trim() && `(${it.strength.trim()})`]
          .filter(Boolean)
          .join(" ") || "—",
        strength: it.strength || null,
        dosage_form: it.dosage_form || null,
        route: it.route || null,
        units_per_dose: it.units_per_dose || null,
        units_per_day: it.units_per_day || null,
        frequency: it.frequency || "—",
        duration: it.duration || null,
        instructions: it.instructions || null,
        is_controlled: it.is_controlled,
      })),
    );

    setLoading(false);

    if (itemsError) {
      setError(itemsError.message);
      return;
    }

    setItems([{ ...EMPTY_ITEM }]);
    setNotes("");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-line bg-white/60 p-6"
    >
      <div>
        <p className="font-display text-lg text-deep">Nueva receta</p>
        <p className="text-xs text-ink/50">
          Después de guardarla puedes imprimirla en tamaño A6 para firmarla y sellarla a mano; no
          lleva firma electrónica. Los medicamentos controlados no se imprimen: se registran solo
          como historial y deben prescribirse en el recetario oficial de la DNCD.
        </p>
      </div>

      <datalist id="dosage-forms">
        {DOSAGE_FORMS.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
      <datalist id="routes">
        {ROUTES.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>

      <div className="flex flex-col gap-3">
        {items.map((item, i) => (
          <div key={i} className="grid gap-3 rounded-md border border-line bg-white p-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink/80">Medicamento</label>
              <input
                value={item.medication_name}
                onChange={(e) => updateItem(i, { medication_name: e.target.value })}
                className={inputClass}
                placeholder="Sertralina"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink/80">Concentración</label>
              <input
                value={item.strength}
                onChange={(e) => updateItem(i, { strength: e.target.value })}
                className={inputClass}
                placeholder="50 mg"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink/80">Forma farmacéutica</label>
              <input
                list="dosage-forms"
                value={item.dosage_form}
                onChange={(e) => updateItem(i, { dosage_form: e.target.value })}
                className={inputClass}
                placeholder="Tableta"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink/80">Vía</label>
              <input
                list="routes"
                value={item.route}
                onChange={(e) => updateItem(i, { route: e.target.value })}
                className={inputClass}
                placeholder="Oral"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink/80">Cantidad por toma</label>
              <input
                value={item.units_per_dose}
                onChange={(e) => updateItem(i, { units_per_dose: e.target.value })}
                className={inputClass}
                placeholder="1 tableta"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink/80">Frecuencia</label>
              <input
                value={item.frequency}
                onChange={(e) => updateItem(i, { frequency: e.target.value })}
                className={inputClass}
                placeholder="Cada 24 horas, en la noche"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink/80">Cantidad por día</label>
              <input
                value={item.units_per_day}
                onChange={(e) => updateItem(i, { units_per_day: e.target.value })}
                className={inputClass}
                placeholder="1 tableta"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink/80">Duración</label>
              <input
                value={item.duration}
                onChange={(e) => updateItem(i, { duration: e.target.value })}
                className={inputClass}
                placeholder="30 días"
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-sm font-medium text-ink/80">Instrucciones (opcional)</label>
              <input
                value={item.instructions}
                onChange={(e) => updateItem(i, { instructions: e.target.value })}
                className={inputClass}
                placeholder="Tomar con alimentos"
              />
            </div>
            <div className="flex items-center justify-between sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-ink/70">
                <input
                  type="checkbox"
                  checked={item.is_controlled}
                  onChange={(e) => updateItem(i, { is_controlled: e.target.checked })}
                />
                Medicamento controlado
              </label>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  className="text-sm font-medium text-clay hover:underline"
                >
                  Quitar
                </button>
              )}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addItem}
          className="self-start text-sm font-medium text-deep underline decoration-deep/30 underline-offset-2"
        >
          + Agregar otro medicamento
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Indicaciones generales (opcional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className={inputClass}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-clay">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="self-start rounded-md bg-deep px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-deepLight disabled:opacity-60"
      >
        {loading ? "Guardando..." : "Guardar receta"}
      </button>
    </form>
  );
}
