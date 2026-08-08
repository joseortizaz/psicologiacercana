"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { logDocumentAccess } from "@/lib/print-audit";
import {
  downloadClinicalRecordPdf,
  RECORD_CASE_STATUS_LABELS,
  RECORD_CATEGORY_LABELS,
  RECORD_DIAGNOSIS_STATUS_LABELS,
  RECORD_DIAGNOSIS_TYPE_LABELS,
  RECORD_HISTORY_SECTION_FIELDS,
  RECORD_MODALITY_LABELS,
  RECORD_SENSITIVE_SECTION_FIELDS,
  formatRecordDateOnly,
  type ClinicalRecordPdfData,
  type RecordSectionSelection,
} from "@/lib/pdf-export";
import type { Patient } from "@/lib/types";

const DEFAULT_SECTIONS: RecordSectionSelection = {
  patientInfo: true,
  consultations: true,
  diagnoses: true,
  prescriptions: true,
};

/** Botón para imprimir o exportar en PDF el expediente clínico de un
 *  paciente, dejando registro en audit_logs cada vez. Soporta dos modos:
 *  - `data`: los datos ya están cargados en la página (therapist/
 *    psychiatrist/supervisor, que ya consultan clinical_records/
 *    consultations/diagnoses/prescriptions vía RLS directa).
 *  - `loadData`: los datos se cargan bajo demanda al abrir el modal, vía
 *    una función provista por el caller (usada por org_admin, que no tiene
 *    acceso RLS directo y depende del RPC admin_read_clinical_record_full). */
export function PrintExportRecordButton({
  label = "Imprimir / exportar expediente",
  data,
  loadData,
}: {
  label?: string;
  data?: ClinicalRecordPdfData;
  loadData?: () => Promise<ClinicalRecordPdfData | null>;
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [sections, setSections] = useState<RecordSectionSelection>(DEFAULT_SECTIONS);
  const [loadedData, setLoadedData] = useState<ClinicalRecordPdfData | null>(data ?? null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"print" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    setOpen(true);
    setError(null);
    if (data) {
      setLoadedData(data);
      return;
    }
    if (loadData && !loadedData) {
      setLoading(true);
      try {
        const result = await loadData();
        if (!result) {
          setError("Este paciente todavía no tiene expediente clínico.");
        }
        setLoadedData(result);
      } catch {
        setError("No se pudo cargar el expediente. Inténtalo de nuevo.");
      } finally {
        setLoading(false);
      }
    }
  }

  function toggleSection(key: keyof RecordSectionSelection) {
    setSections((s) => ({ ...s, [key]: !s[key] }));
  }

  const anySectionSelected = Object.values(sections).some(Boolean);

  async function logAccess(action: "PRINT" | "EXPORT_PDF") {
    if (!loadedData) return;
    const recordId = loadedData.clinicalRecord?.id ?? loadedData.patient.id;
    const table = loadedData.clinicalRecord ? "clinical_records" : "patients";
    await logDocumentAccess(supabase, table, recordId, action);
  }

  async function handlePrint() {
    if (!loadedData || !anySectionSelected) return;
    setBusy("print");
    try {
      await logAccess("PRINT");
      // Espera un tick para asegurar que el área de impresión ya está en el
      // DOM con los datos/secciones actuales antes de invocar el diálogo.
      requestAnimationFrame(() => window.print());
    } finally {
      setBusy(null);
    }
  }

  async function handleExportPdf() {
    if (!loadedData || !anySectionSelected) return;
    setBusy("pdf");
    try {
      downloadClinicalRecordPdf(loadedData, sections);
      await logAccess("EXPORT_PDF");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-md border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink/70 transition hover:border-deep/40 hover:text-ink"
      >
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-line bg-paper p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <p className="font-display text-lg text-deep">Imprimir / exportar expediente</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-ink/40 hover:text-ink"
              >
                Cerrar
              </button>
            </div>

            {loading && <p className="mt-4 text-sm text-ink/50">Cargando expediente...</p>}
            {error && <p className="mt-4 text-sm text-clay">{error}</p>}

            {loadedData && !loading && (
              <>
                <p className="mt-4 text-sm text-ink/60">
                  Selecciona las secciones a incluir para {loadedData.patient.full_name}.
                </p>

                <div className="mt-3 flex flex-col gap-2">
                  <SectionCheckbox
                    checked={sections.patientInfo}
                    onChange={() => toggleSection("patientInfo")}
                    label="Datos del paciente + historia clínica"
                  />
                  <SectionCheckbox
                    checked={sections.consultations}
                    onChange={() => toggleSection("consultations")}
                    label="Consultas / notas de sesión"
                  />
                  <SectionCheckbox
                    checked={sections.diagnoses}
                    onChange={() => toggleSection("diagnoses")}
                    label="Diagnósticos CIE-11"
                  />
                  <SectionCheckbox
                    checked={sections.prescriptions}
                    onChange={() => toggleSection("prescriptions")}
                    label="Recetas / prescripciones"
                  />
                </div>

                {!anySectionSelected && (
                  <p className="mt-3 text-xs text-clay">Selecciona al menos una sección.</p>
                )}

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handlePrint}
                    disabled={!anySectionSelected || busy !== null}
                    className="rounded-md border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink/70 transition hover:border-deep/40 hover:text-ink disabled:opacity-50"
                  >
                    {busy === "print" ? "Preparando..." : "Imprimir"}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    disabled={!anySectionSelected || busy !== null}
                    className="rounded-md bg-deep px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-deep/90 disabled:opacity-50"
                  >
                    {busy === "pdf" ? "Generando..." : "Exportar PDF"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {loadedData && (
        <div id="print-record-area">
          <PrintableRecord data={loadedData} sections={sections} />
        </div>
      )}
    </>
  );
}

/** Variante para org_admin: no tiene acceso RLS directo a clinical_records/
 *  consultations/diagnoses/prescription_records, así que carga el expediente
 *  bajo demanda vía el RPC de acceso elevado y auditado
 *  `admin_read_clinical_record_full` (ver migración
 *  20260808000000_import_export_print_audit.sql). Esa misma llamada ya deja
 *  un evento SELECT en audit_logs; el modal reutiliza el flujo normal de
 *  impresión/exportación (que además registra PRINT/EXPORT_PDF). */
export function AdminPrintExportRecordButton({ patient }: { patient: Patient }) {
  const supabase = createClient();

  async function loadData(): Promise<ClinicalRecordPdfData | null> {
    const { data, error } = await supabase.rpc("admin_read_clinical_record_full", {
      p_patient_id: patient.id,
    });
    if (error || !data) return null;
    const raw = data as {
      clinical_record: ClinicalRecordPdfData["clinicalRecord"];
      consultations: ClinicalRecordPdfData["consultations"];
      diagnoses: ClinicalRecordPdfData["diagnoses"];
      prescriptions: ClinicalRecordPdfData["prescriptions"];
    };
    return {
      patient,
      clinicalRecord: raw.clinical_record ?? null,
      consultations: raw.consultations ?? [],
      diagnoses: raw.diagnoses ?? [],
      prescriptions: raw.prescriptions ?? [],
    };
  }

  return <PrintExportRecordButton label="Ver / imprimir expediente" loadData={loadData} />;
}

function SectionCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink/80">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 rounded border-line" />
      {label}
    </label>
  );
}

/** Vista de solo texto usada exclusivamente para impresión (ver
 *  #print-record-area en app/globals.css). Deliberadamente simple: sin
 *  colores decorativos, pensada para papel. */
function PrintableRecord({
  data,
  sections,
}: {
  data: ClinicalRecordPdfData;
  sections: RecordSectionSelection;
}) {
  const { patient, clinicalRecord, consultations, diagnoses, prescriptions } = data;

  return (
    <div style={{ fontFamily: "Arial, sans-serif", color: "#111", fontSize: "12px", lineHeight: 1.5 }}>
      <h1 style={{ fontSize: "18px", marginBottom: "2px" }}>Expediente clínico</h1>
      <p style={{ color: "#666", fontSize: "10px", marginBottom: "16px" }}>
        Generado el {new Date().toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" })}
      </p>

      {sections.patientInfo && (
        <section style={{ marginBottom: "18px" }}>
          <h2 style={{ fontSize: "14px", borderBottom: "1px solid #ccc", paddingBottom: "4px" }}>
            Datos del paciente
          </h2>
          <p>
            <strong>Nombre:</strong> {patient.full_name}
          </p>
          <p>
            <strong>Categoría:</strong> {RECORD_CATEGORY_LABELS[patient.category] ?? patient.category}
          </p>
          <p>
            <strong>Nacimiento:</strong> {formatRecordDateOnly(patient.date_of_birth)}
          </p>
          {patient.gender && (
            <p>
              <strong>Género:</strong> {patient.gender}
            </p>
          )}
          {patient.national_id && (
            <p>
              <strong>Identificación:</strong> {patient.national_id}
            </p>
          )}
          {patient.contact_email && (
            <p>
              <strong>Correo:</strong> {patient.contact_email}
            </p>
          )}
          {patient.contact_phone && (
            <p>
              <strong>Teléfono:</strong> {patient.contact_phone}
            </p>
          )}
          {patient.address && (
            <p>
              <strong>Dirección:</strong> {patient.address}
            </p>
          )}

          {clinicalRecord ? (
            <div style={{ marginTop: "10px" }}>
              <h3 style={{ fontSize: "12.5px" }}>Historia clínica</h3>
              <p>
                <strong>Estado del caso:</strong>{" "}
                {RECORD_CASE_STATUS_LABELS[clinicalRecord.status] ?? clinicalRecord.status}
              </p>
              {clinicalRecord.chief_complaint && (
                <p>
                  <strong>Motivo de consulta:</strong> {clinicalRecord.chief_complaint}
                </p>
              )}
              {clinicalRecord.diagnosis_hypothesis && (
                <p>
                  <strong>Hipótesis diagnóstica:</strong> {clinicalRecord.diagnosis_hypothesis}
                </p>
              )}
              {clinicalRecord.diagnosis && (
                <p>
                  <strong>Diagnóstico:</strong> {clinicalRecord.diagnosis}
                </p>
              )}
              {clinicalRecord.therapeutic_objectives && (
                <p>
                  <strong>Objetivos terapéuticos:</strong> {clinicalRecord.therapeutic_objectives}
                </p>
              )}
              {clinicalRecord.treatment_plan && (
                <p>
                  <strong>Plan de tratamiento:</strong> {clinicalRecord.treatment_plan}
                </p>
              )}
              {clinicalRecord.medications?.length > 0 && (
                <p>
                  <strong>Medicamentos:</strong> {clinicalRecord.medications.join(", ")}
                </p>
              )}
              {clinicalRecord.allergies?.length > 0 && (
                <p>
                  <strong>Alergias:</strong> {clinicalRecord.allergies.join(", ")}
                </p>
              )}
              {RECORD_HISTORY_SECTION_FIELDS.filter((f) => clinicalRecord.history_sections?.[f.key]).map(
                (f) => (
                  <p key={f.key}>
                    <strong>{f.label}:</strong> {clinicalRecord.history_sections[f.key]}
                  </p>
                ),
              )}
              {RECORD_SENSITIVE_SECTION_FIELDS.filter((f) => clinicalRecord.sensitive_history?.[f.key]).map(
                (f) => (
                  <p key={f.key}>
                    <strong>{f.label}:</strong> {clinicalRecord.sensitive_history[f.key]}
                  </p>
                ),
              )}
            </div>
          ) : (
            <p style={{ marginTop: "10px", color: "#666" }}>
              Este paciente todavía no tiene expediente clínico.
            </p>
          )}
        </section>
      )}

      {sections.consultations && (
        <section style={{ marginBottom: "18px" }}>
          <h2 style={{ fontSize: "14px", borderBottom: "1px solid #ccc", paddingBottom: "4px" }}>
            Consultas / notas de sesión
          </h2>
          {consultations.length === 0 ? (
            <p style={{ color: "#666" }}>Todavía no hay notas de sesión registradas.</p>
          ) : (
            consultations.map((c) => (
              <div key={c.id} style={{ marginTop: "8px", paddingBottom: "8px", borderBottom: "1px solid #eee" }}>
                <p style={{ fontWeight: "bold" }}>
                  {formatRecordDateOnly(c.session_date)} · {RECORD_MODALITY_LABELS[c.modality] ?? c.modality}
                  {c.status === "finalized" ? " · Finalizada" : " · Borrador"}
                </p>
                {c.reason && (
                  <p>
                    <strong>Motivo:</strong> {c.reason}
                  </p>
                )}
                {c.objectives && (
                  <p>
                    <strong>Objetivos:</strong> {c.objectives}
                  </p>
                )}
                {c.interventions && (
                  <p>
                    <strong>Intervenciones:</strong> {c.interventions}
                  </p>
                )}
                {c.observations && (
                  <p>
                    <strong>Observaciones:</strong> {c.observations}
                  </p>
                )}
                {c.homework_tasks && (
                  <p>
                    <strong>Tareas:</strong> {c.homework_tasks}
                  </p>
                )}
              </div>
            ))
          )}
        </section>
      )}

      {sections.diagnoses && (
        <section style={{ marginBottom: "18px" }}>
          <h2 style={{ fontSize: "14px", borderBottom: "1px solid #ccc", paddingBottom: "4px" }}>
            Diagnósticos CIE-11
          </h2>
          {diagnoses.length === 0 ? (
            <p style={{ color: "#666" }}>Todavía no hay diagnósticos registrados.</p>
          ) : (
            diagnoses.map((d) => (
              <div key={d.id} style={{ marginTop: "8px", paddingBottom: "8px", borderBottom: "1px solid #eee" }}>
                <p style={{ fontWeight: "bold" }}>
                  {d.diagnosis_code?.code} · {d.diagnosis_code?.title ?? "—"}
                </p>
                <p>
                  <strong>Tipo:</strong> {RECORD_DIAGNOSIS_TYPE_LABELS[d.type] ?? d.type} ·{" "}
                  <strong>Estado:</strong> {RECORD_DIAGNOSIS_STATUS_LABELS[d.status] ?? d.status}
                </p>
                <p>
                  <strong>Fecha:</strong> {formatRecordDateOnly(d.diagnosed_at)}
                  {d.diagnosed_by_profile?.full_name ? ` · ${d.diagnosed_by_profile.full_name}` : ""}
                </p>
                {d.notes && (
                  <p>
                    <strong>Notas:</strong> {d.notes}
                  </p>
                )}
              </div>
            ))
          )}
        </section>
      )}

      {sections.prescriptions && (
        <section>
          <h2 style={{ fontSize: "14px", borderBottom: "1px solid #ccc", paddingBottom: "4px" }}>
            Recetas / prescripciones
          </h2>
          {prescriptions.length === 0 ? (
            <p style={{ color: "#666" }}>Todavía no hay recetas registradas.</p>
          ) : (
            prescriptions.map((r) => (
              <div key={r.id} style={{ marginTop: "8px", paddingBottom: "8px", borderBottom: "1px solid #eee" }}>
                <p style={{ fontWeight: "bold" }}>
                  {formatRecordDateOnly(r.issued_at)}
                  {r.prescribing_clinician?.full_name ? ` · ${r.prescribing_clinician.full_name}` : ""}
                </p>
                {(r.items ?? []).map((item) => (
                  <p key={item.id}>
                    <strong>{item.medication_name}:</strong> {item.dosage} · {item.frequency}
                    {item.duration ? ` · ${item.duration}` : ""}
                    {item.is_controlled ? " · Controlado" : ""}
                    {item.instructions ? ` · ${item.instructions}` : ""}
                  </p>
                ))}
                {r.notes && (
                  <p>
                    <strong>Notas:</strong> {r.notes}
                  </p>
                )}
              </div>
            ))
          )}
        </section>
      )}
    </div>
  );
}
