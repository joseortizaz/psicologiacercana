"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toCsv, downloadTextFile } from "@/lib/csv";
import { logDocumentAccess, generateBatchId, type DocumentAccessTable } from "@/lib/print-audit";

/** Botón genérico de "Exportar CSV": arma el CSV en el cliente a partir de
 *  filas ya cargadas (que ya pasaron por RLS), lo descarga, y deja un evento
 *  EXPORT_CSV en audit_logs. No vuelve a consultar la base de datos: exporta
 *  exactamente lo que el usuario está viendo en pantalla. */
export function ExportCsvButton<T extends Record<string, unknown>>({
  rows,
  columns,
  filename,
  auditTable,
  label = "Exportar CSV",
}: {
  rows: T[];
  columns: { key: keyof T; label: string }[];
  filename: string;
  /** Tabla que se usa para el registro de auditoría (ver log_document_access). */
  auditTable: DocumentAccessTable;
  label?: string;
}) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    if (rows.length === 0) return;
    setLoading(true);
    try {
      const csv = toCsv(rows, columns);
      downloadTextFile(filename, csv);
      await logDocumentAccess(supabase, auditTable, generateBatchId(), "EXPORT_CSV");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading || rows.length === 0}
      className="rounded-md border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink/70 transition hover:border-deep/40 hover:text-ink disabled:opacity-50"
    >
      {loading ? "Exportando..." : label}
    </button>
  );
}
