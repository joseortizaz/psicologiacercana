"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface ItemDraft {
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  is_controlled: boolean;
}

const EMPTY_ITEM: ItemDraft = {
  medication_name: "",
  dosage: "",
  frequency: "",
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
    const validItems = items.filter((it) => it.medication_name.trim() && it.dosage.trim() && it.frequency.trim());
    if (validItems.length === 0) {
      setError("Agrega al menos un medicamento con nombre, dosis y frecuencia.");
      return;
    }

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
        dosage: it.dosage,
        frequency: it.frequency,
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
        <p className="font-display text-lg text-deep">Nueva receta (registro interno)</p>
        <p className="text-xs text-ink/50">
          Esto es solo un histórico consultable desde el Portal — no sustituye la receta física
          que entregas al paciente y no tiene validez legal por sí sola.
        </p>
      </div>

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
              <label className="text-sm font-medium text-ink/80">Dosis</label>
              <input
                value={item.dosage}
                onChange={(e) => updateItem(i, { dosage: e.target.value })}
                className={inputClass}
                placeholder="50 mg"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink/80">Frecuencia</label>
              <input
                value={item.frequency}
                onChange={(e) => updateItem(i, { frequency: e.target.value })}
                className={inputClass}
                placeholder="Cada 24 horas"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink/80">Duración (opcional)</label>
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
        <label className="text-sm font-medium text-ink/80">Notas (opcional)</label>
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
