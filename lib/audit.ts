export const AUDIT_TABLE_LABELS: Record<string, string> = {
  clinics: "Sucursales",
  profiles: "Personal",
  patients: "Pacientes",
  clinical_records: "Expedientes clínicos",
  appointments: "Citas",
  consultations: "Consultas",
  consents: "Consentimientos",
  patient_diagnoses: "Diagnósticos",
  prescription_records: "Recetas",
  audit_logs: "Auditoría",
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  INSERT: "Creación",
  UPDATE: "Actualización",
  DELETE: "Eliminación",
  SELECT: "Acceso elevado",
  PRINT: "Impresión",
  EXPORT_PDF: "Exportación PDF",
  EXPORT_CSV: "Exportación CSV",
};

export const AUDIT_ACTION_BADGE_CLASSES: Record<string, string> = {
  INSERT: "bg-sage/15 text-sage",
  UPDATE: "bg-amber-500/15 text-amber-700",
  DELETE: "bg-red-500/15 text-red-700",
  SELECT: "bg-clay/15 text-clay",
  PRINT: "bg-deep/10 text-deep",
  EXPORT_PDF: "bg-deep/10 text-deep",
  EXPORT_CSV: "bg-deep/10 text-deep",
};

export interface AuditLogEntry {
  id: number;
  actor_id: string | null;
  organization_id: string | null;
  table_name: string;
  record_id: string;
  action: string;
  occurred_at: string;
}
