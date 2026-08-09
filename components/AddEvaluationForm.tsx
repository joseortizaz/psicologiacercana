"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DocumentUploadField } from "@/components/DocumentUploadField";
import type { PatientDiagnosis } from "@/lib/types";

const inputClass =
  "rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep";

const PDF_ACCEPTED_TYPES = ["application/pdf"];
const PDF_MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15 MiB — debe coincidir con el bucket evaluation-reports

export function AddEvaluationForm({
  organizationId,
  clinicId,
  patientId,
  clinicalRecordId,
  administeredBy,
  diagnoses,
}: {
  organizationId: string;
  clinicId: string;
  patientId: string;
  clinicalRecordId: string;
  administeredBy: string;
  diagnoses: PatientDiagnosis[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [testName, setTestName] = useState("");
  const [administeredAt, setAdministeredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [scoreSummary, setScoreSummary] = useState("");
  const [interpretation, setInterpretation] = useState("");
  const [diagnosisId, setDiagnosisId] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [finalize, setFinalize] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!testName.trim()) {
      setError("Indica el nombre de la prueba aplicada.");
      return;
    }

    setLoading(true);
    setError(null);

    const now = new Date().toISOString();

    // 1) Se crea primero la fila (sin adjunto) para tener el id que define la
    // ruta del archivo en Storage -- ver convención de ruta en
    // 20260808020000_evaluation_reports.sql ({organization_id}/{clinical_record_id}/archivo).
    const { data: report, error: insertError } = await supabase
      .from("evaluation_reports")
      .insert({
        organization_id: organizationId,
        clinic_id: clinicId,
        patient_id: patientId,
        clinical_record_id: clinicalRecordId,
        administered_by: administeredBy,
        diagnosis_id: diagnosisId || null,
        test_name: testName.trim(),
        administered_at: administeredAt,
        score_summary: scoreSummary || null,
        interpretation: interpretation || null,
        status: finalize ? "finalized" : "draft",
        finalized_at: finalize ? now : null,
        created_by: administeredBy,
      })
      .select()
      .single();

    if (insertError || !report) {
      setLoading(false);
      setError(insertError?.message ?? "No se pudo crear el registro de evaluación.");
      return;
    }

    // 2) Si hay PDF, se sube directo al bucket privado con la sesión del
    // propio clínico (RLS de storage.objects ya lo permite -- ver policies
    // evaluation_reports_storage_insert) y se guarda la ruta en la fila.
    if (attachment) {
      const safeName = attachment.name.replace(/[^\w.\-]/g, "_");
      const path = `${organizationId}/${clinicalRecordId}/${report.id}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("evaluation-reports")
        .upload(path, attachment, { contentType: attachment.type });

      if (uploadError) {
        setLoading(false);
        setError(
          `La evaluación se guardó, pero no se pudo subir el PDF adjunto: ${uploadError.message}`,
        );
        router.refresh();
        return;
      }

      const { error: updateError } = await supabase
        .from("evaluation_reports")
        .update({ attachment_path: path })
        .eq("id", report.id);

      if (updateError) {
        setLoading(false);
        setError(
          `La evaluación se guardó y el PDF se subió, pero no se pudo enlazarlo al registro: ${updateError.message}`,
        );
        router.refresh();
        return;
      }
    }

    setLoading(false);
    setTestName("");
    setScoreSummary("");
    setInterpretation("");
    setDiagnosisId("");
    setAttachment(null);
    setFinalize(false);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-line bg-white/60 p-6"
    >
      <div>
        <p className="font-display text-lg text-deep">Nueva evaluación</p>
        <p className="text-xs text-ink/50">
          Solo se registra el resultado y tu interpretación clínica de una prueba que ya aplicaste
          por tus propios medios — no se digitaliza el instrumento en sí.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink/80">Prueba aplicada</label>
          <input
            required
            value={testName}
            onChange={(e) => setTestName(e.target.value)}
            className={inputClass}
            placeholder="WISC-V, MMPI-2, BDI-II..."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink/80">Fecha de aplicación</label>
          <input
            required
            type="date"
            value={administeredAt}
            onChange={(e) => setAdministeredAt(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {diagnoses.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink/80">
            Diagnóstico relacionado (opcional)
          </label>
          <select
            value={diagnosisId}
            onChange={(e) => setDiagnosisId(e.target.value)}
            className={inputClass}
          >
            <option value="">Sin relacionar</option>
            {diagnoses.map((d) => (
              <option key={d.id} value={d.id}>
                {d.diagnosis_code?.code} · {d.diagnosis_code?.title ?? "—"}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Resultado / puntaje resumido</label>
        <textarea
          value={scoreSummary}
          onChange={(e) => setScoreSummary(e.target.value)}
          rows={2}
          className={inputClass}
          placeholder="CIT: 95 (promedio)..."
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Interpretación clínica</label>
        <textarea
          value={interpretation}
          onChange={(e) => setInterpretation(e.target.value)}
          rows={4}
          className={inputClass}
          placeholder="Redacción propia -- nunca texto copiado del manual de la prueba."
        />
      </div>

      <DocumentUploadField
        label="Informe en PDF (opcional)"
        hint="El PDF del informe que ya generaste, si aplica."
        value={attachment}
        onChange={setAttachment}
        required={false}
        acceptedTypes={PDF_ACCEPTED_TYPES}
        maxSizeBytes={PDF_MAX_SIZE_BYTES}
        acceptAttr="application/pdf"
        buttonLabel="Seleccionar PDF"
        typeErrorMessage="Formato no permitido. Solo se aceptan archivos PDF."
      />

      <label className="flex items-center gap-2 text-sm text-ink/70">
        <input type="checkbox" checked={finalize} onChange={(e) => setFinalize(e.target.checked)} />
        Finalizar esta evaluación (ya no se podrá editar)
      </label>

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
        {loading ? "Guardando..." : "Guardar evaluación"}
      </button>
    </form>
  );
}
