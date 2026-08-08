import type { SupabaseClient } from "@supabase/supabase-js";

export type DocumentAccessAction = "PRINT" | "EXPORT_PDF" | "EXPORT_CSV";

export type DocumentAccessTable =
  | "clinical_records"
  | "patients"
  | "appointments"
  | "patient_diagnoses"
  | "prescription_records"
  | "audit_logs";

/** Registra en audit_logs (vía la función log_document_access, ver
 *  20260808000000_import_export_print_audit.sql) que el usuario autenticado
 *  imprimió o exportó algo. No lanza si falla el registro: nunca debe
 *  bloquear la acción de imprimir/exportar en sí, solo se reporta a consola. */
export async function logDocumentAccess(
  supabase: SupabaseClient,
  tableName: DocumentAccessTable,
  recordId: string,
  action: DocumentAccessAction,
): Promise<void> {
  const { error } = await supabase.rpc("log_document_access", {
    p_table_name: tableName,
    p_record_id: recordId,
    p_action: action,
  });
  if (error) {
    console.error("No se pudo registrar el evento de auditoría de impresión/exportación:", error);
  }
}

/** uuid v4 sencillo para identificar, en audit_logs, un lote de exportación
 *  que no corresponde a una sola fila (ej. "exportar todos los pacientes").
 *  crypto.randomUUID() está disponible en todos los navegadores soportados;
 *  este fallback solo cubre entornos sin ese API. */
export function generateBatchId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
