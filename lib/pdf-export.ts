import { jsPDF } from "jspdf";
import type {
  ClinicalHistorySections,
  ClinicalRecord,
  ClinicalSensitiveHistory,
  Consultation,
  Patient,
  PatientDiagnosis,
  PrescriptionRecord,
} from "@/lib/types";

export interface ClinicalRecordPdfData {
  patient: Patient;
  clinicalRecord: ClinicalRecord | null;
  consultations: Consultation[];
  diagnoses: PatientDiagnosis[];
  prescriptions: PrescriptionRecord[];
}

export interface RecordSectionSelection {
  patientInfo: boolean;
  consultations: boolean;
  diagnoses: boolean;
  prescriptions: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  child: "Niño/a",
  adolescent: "Adolescente",
  adult: "Adulto",
};

const MODALITY_LABELS: Record<string, string> = {
  in_person: "Presencial",
  virtual: "Virtual",
  phone: "Telefónica",
};

const CASE_STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  in_treatment: "En tratamiento",
  discharged: "Alta",
  suspended: "Suspendido",
};

const DIAGNOSIS_TYPE_LABELS: Record<string, string> = {
  principal: "Principal",
  secundario: "Secundario",
};

const DIAGNOSIS_STATUS_LABELS: Record<string, string> = {
  activo: "Activo",
  en_remisión: "En remisión",
  descartado: "Descartado",
};

const HISTORY_SECTION_FIELDS: { key: keyof ClinicalHistorySections; label: string }[] = [
  { key: "personal_history", label: "Historia personal" },
  { key: "family_history", label: "Antecedentes familiares" },
  { key: "medical_history", label: "Antecedentes médicos" },
  { key: "psychiatric_history", label: "Antecedentes psicológicos/psiquiátricos" },
  { key: "social_history", label: "Historia social" },
  { key: "mental_status_exam", label: "Examen del estado mental" },
];

const SENSITIVE_SECTION_FIELDS: { key: keyof ClinicalSensitiveHistory; label: string }[] = [
  { key: "substance_use", label: "Consumo de sustancias" },
  { key: "trauma_history", label: "Historia de trauma o abuso" },
  { key: "risk_history", label: "Riesgo (ideación/intento suicida, autolesión)" },
  { key: "legal_history", label: "Historia legal" },
];

function formatDateOnly(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("es-MX", { dateStyle: "long" });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

/** Genera el PDF del expediente clínico como texto (no imagen/raster), a
 *  partir de los datos ya cargados y traídos por RLS/RPC. No usa
 *  html2canvas: arma el layout manualmente con jsPDF para mantener el
 *  archivo liviano y con texto seleccionable/buscable. */
export function buildClinicalRecordPdf(
  data: ClinicalRecordPdfData,
  sections: RecordSectionSelection,
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const marginX = 18;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - marginX * 2;
  let y = 20;

  function ensureSpace(needed: number) {
    if (y + needed > pageHeight - 18) {
      doc.addPage();
      y = 20;
    }
  }

  function addTitle(text: string) {
    ensureSpace(10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 45);
    doc.text(text, marginX, y);
    y += 7;
    doc.setDrawColor(210, 210, 210);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 6;
  }

  function addSubtitle(text: string) {
    ensureSpace(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 45);
    doc.text(text, marginX, y);
    y += 6;
  }

  function addField(label: string, value: string | null | undefined) {
    if (!value) return;
    ensureSpace(6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(60, 60, 60);
    const labelText = `${label}: `;
    doc.text(labelText, marginX, y);
    const labelWidth = doc.getTextWidth(labelText);
    doc.setFont("helvetica", "normal");
    const lines: string[] = doc.splitTextToSize(value, contentWidth - labelWidth);
    doc.text(lines[0] ?? "", marginX + labelWidth, y);
    y += 5;
    for (let i = 1; i < lines.length; i++) {
      ensureSpace(5);
      doc.text(lines[i], marginX, y);
      y += 5;
    }
    y += 1;
  }

  function addParagraph(text: string) {
    ensureSpace(6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(60, 60, 60);
    const lines: string[] = doc.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      ensureSpace(5);
      doc.text(line, marginX, y);
      y += 5;
    }
    y += 2;
  }

  function addDivider() {
    ensureSpace(4);
    doc.setDrawColor(230, 230, 230);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 4;
  }

  // Encabezado general
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 45);
  doc.text("Expediente clínico", marginX, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generado el ${new Date().toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" })}`, marginX, y);
  y += 9;

  const { patient, clinicalRecord, consultations, diagnoses, prescriptions } = data;

  if (sections.patientInfo) {
    addTitle("Datos del paciente");
    addField("Nombre completo", patient.full_name);
    addField("Categoría", CATEGORY_LABELS[patient.category] ?? patient.category);
    addField("Fecha de nacimiento", formatDateOnly(patient.date_of_birth));
    addField("Género", patient.gender);
    addField("Identificación", patient.national_id);
    addField("Correo", patient.contact_email);
    addField("Teléfono", patient.contact_phone);
    addField("Dirección", patient.address);
    addField("Ocupación", patient.occupation);
    addField("Referido por", patient.referred_by);
    if (patient.guardian_name) {
      addField(
        "Tutor",
        `${patient.guardian_name}${patient.guardian_relationship ? ` (${patient.guardian_relationship})` : ""}${
          patient.guardian_phone ? ` · ${patient.guardian_phone}` : ""
        }`,
      );
    }
    if (patient.emergency_contact_name) {
      addField(
        "Contacto de emergencia",
        `${patient.emergency_contact_name}${
          patient.emergency_contact_relationship ? ` (${patient.emergency_contact_relationship})` : ""
        }${patient.emergency_contact_phone ? ` · ${patient.emergency_contact_phone}` : ""}`,
      );
    }
    if (patient.insurance_provider) {
      addField(
        "Seguro",
        `${patient.insurance_provider}${
          patient.insurance_policy_number ? ` · Póliza ${patient.insurance_policy_number}` : ""
        }`,
      );
    }
    y += 3;

    if (clinicalRecord) {
      addSubtitle("Historia clínica");
      addField("Estado del caso", CASE_STATUS_LABELS[clinicalRecord.status] ?? clinicalRecord.status);
      addField("Motivo de consulta", clinicalRecord.chief_complaint);
      addField("Hipótesis diagnóstica", clinicalRecord.diagnosis_hypothesis);
      addField("Diagnóstico", clinicalRecord.diagnosis);
      addField("Objetivos terapéuticos", clinicalRecord.therapeutic_objectives);
      addField("Plan de tratamiento", clinicalRecord.treatment_plan);
      if (clinicalRecord.medications?.length) {
        addField("Medicamentos", clinicalRecord.medications.join(", "));
      }
      if (clinicalRecord.allergies?.length) {
        addField("Alergias", clinicalRecord.allergies.join(", "));
      }
      for (const f of HISTORY_SECTION_FIELDS) {
        addField(f.label, clinicalRecord.history_sections?.[f.key]);
      }
      for (const f of SENSITIVE_SECTION_FIELDS) {
        addField(f.label, clinicalRecord.sensitive_history?.[f.key]);
      }
      if (clinicalRecord.status === "discharged") {
        addField(
          "Alta",
          `${clinicalRecord.discharge_date ? formatDateOnly(clinicalRecord.discharge_date) : ""}${
            clinicalRecord.discharge_summary ? ` — ${clinicalRecord.discharge_summary}` : ""
          }`,
        );
      }
    } else {
      addParagraph("Este paciente todavía no tiene expediente clínico.");
    }
    y += 2;
  }

  if (sections.consultations) {
    addTitle("Consultas / notas de sesión");
    if (consultations.length === 0) {
      addParagraph("Todavía no hay notas de sesión registradas.");
    } else {
      for (const c of consultations) {
        ensureSpace(10);
        addSubtitle(
          `${formatDateOnly(c.session_date)} · ${MODALITY_LABELS[c.modality] ?? c.modality}${
            c.status === "finalized" ? " · Finalizada" : " · Borrador"
          }`,
        );
        addField("Motivo", c.reason);
        addField("Objetivos", c.objectives);
        addField("Intervenciones", c.interventions);
        addField("Observaciones", c.observations);
        addField("Tareas asignadas", c.homework_tasks);
        addDivider();
      }
    }
    y += 2;
  }

  if (sections.diagnoses) {
    addTitle("Diagnósticos CIE-11");
    if (diagnoses.length === 0) {
      addParagraph("Todavía no hay diagnósticos registrados.");
    } else {
      for (const d of diagnoses) {
        ensureSpace(10);
        addSubtitle(`${d.diagnosis_code?.code ?? ""} · ${d.diagnosis_code?.title ?? "—"}`);
        addField("Tipo", DIAGNOSIS_TYPE_LABELS[d.type] ?? d.type);
        addField("Estado", DIAGNOSIS_STATUS_LABELS[d.status] ?? d.status);
        addField("Fecha", formatDateOnly(d.diagnosed_at));
        addField("Diagnosticado por", d.diagnosed_by_profile?.full_name);
        addField("Notas", d.notes);
        addDivider();
      }
    }
    y += 2;
  }

  if (sections.prescriptions) {
    addTitle("Recetas / prescripciones");
    if (prescriptions.length === 0) {
      addParagraph("Todavía no hay recetas registradas.");
    } else {
      for (const r of prescriptions) {
        ensureSpace(10);
        addSubtitle(
          `${formatDateOnly(r.issued_at)}${
            r.prescribing_clinician?.full_name ? ` · ${r.prescribing_clinician.full_name}` : ""
          }`,
        );
        for (const item of r.items ?? []) {
          addField(
            item.medication_name,
            `${item.dosage} · ${item.frequency}${item.duration ? ` · ${item.duration}` : ""}${
              item.is_controlled ? " · Controlado" : ""
            }${item.instructions ? ` · ${item.instructions}` : ""}`,
          );
        }
        addField("Notas", r.notes);
        addDivider();
      }
    }
  }

  // Pie de página con numeración.
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - marginX, pageHeight - 10, { align: "right" });
    doc.text(`${data.patient.full_name} — Documento confidencial`, marginX, pageHeight - 10);
  }

  return doc;
}

export function downloadClinicalRecordPdf(data: ClinicalRecordPdfData, sections: RecordSectionSelection) {
  const doc = buildClinicalRecordPdf(data, sections);
  const filenameSafe = data.patient.full_name.replace(/[^\p{L}\p{N}]+/gu, "_");
  doc.save(`expediente_${filenameSafe}.pdf`);
}

/** Formatea la misma información en texto plano estructurado para la vista
 *  de impresión del navegador (ver components/PrintExportRecordButton.tsx). */
export { formatDateOnly as formatRecordDateOnly, formatDateTime as formatRecordDateTime };
export {
  CATEGORY_LABELS as RECORD_CATEGORY_LABELS,
  MODALITY_LABELS as RECORD_MODALITY_LABELS,
  CASE_STATUS_LABELS as RECORD_CASE_STATUS_LABELS,
  DIAGNOSIS_TYPE_LABELS as RECORD_DIAGNOSIS_TYPE_LABELS,
  DIAGNOSIS_STATUS_LABELS as RECORD_DIAGNOSIS_STATUS_LABELS,
  HISTORY_SECTION_FIELDS as RECORD_HISTORY_SECTION_FIELDS,
  SENSITIVE_SECTION_FIELDS as RECORD_SENSITIVE_SECTION_FIELDS,
};
