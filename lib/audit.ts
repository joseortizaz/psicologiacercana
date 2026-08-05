export const AUDIT_TABLE_LABELS: Record<string, string> = {
  clinics: "Sucursales",
  profiles: "Personal",
  patients: "Pacientes",
  clinical_records: "Expedientes clínicos",
  appointments: "Citas",
  consultations: "Consultas",
  consents: "Consentimientos",
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  INSERT: "Creación",
  UPDATE: "Actualización",
  DELETE: "Eliminación",
  SELECT: "Acceso elevado",
};

export const AUDIT_ACTION_BADGE_CLASSES: Record<string, string> = {
  INSERT: "bg-sage/15 text-sage",
  UPDATE: "bg-amber-500/15 text-amber-700",
  DELETE: "bg-red-500/15 text-red-700",
  SELECT: "bg-clay/15 text-clay",
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
