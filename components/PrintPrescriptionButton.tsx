"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { logDocumentAccess } from "@/lib/print-audit";
import {
  CONTROLLED_NOTICE,
  generatePrescriptionPdf,
  hasControlledItems,
  printableItems,
  type PrescriptionPrintContext,
} from "@/lib/prescription-pdf";
import type { PrescriptionRecord } from "@/lib/types";

export function PrintPrescriptionButton({
  record,
  context,
}: {
  record: PrescriptionRecord;
  context: PrescriptionPrintContext;
}) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const printable = printableItems(record);
  const controlled = hasControlledItems(record);
  const missingLicense = !context.prescriber.license_number?.trim();

  async function handlePrint() {
    setError(null);
    setLoading(true);
    // Se abre la pestaña antes del trabajo asíncrono para que el navegador no
    // la bloquee como ventana emergente.
    const tab = window.open("", "_blank");
    try {
      const { doc, filename } = await generatePrescriptionPdf(record, context);
      const url = String(doc.output("bloburl"));
      if (tab) {
        tab.location.href = url;
      } else {
        doc.save(filename);
      }
      await logDocumentAccess(supabase, "prescription_records", record.id, "PRINT");
    } catch (e) {
      tab?.close();
      setError(e instanceof Error ? e.message : "No se pudo generar la receta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <div>
        <button
          type="button"
          onClick={handlePrint}
          disabled={loading || printable.length === 0}
          className="rounded-md border border-deep px-3 py-1.5 text-sm font-medium text-deep transition hover:bg-deep hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Generando..." : "Imprimir receta (A6)"}
        </button>
      </div>
      {missingLicense && (
        <p className="text-xs text-clay">
          Tu exequátur no está cargado: la receta saldrá con la línea en blanco.{" "}
          <a href="/account" className="underline">
            Complétalo en Ajustes de cuenta
          </a>
          .
        </p>
      )}
      {controlled && (
        <p className="text-xs text-clay">
          {printable.length === 0
            ? `No se puede imprimir: todos los medicamentos son controlados. ${CONTROLLED_NOTICE}`
            : `Se imprimirán solo los medicamentos no controlados. ${CONTROLLED_NOTICE}`}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-clay">
          {error}
        </p>
      )}
    </div>
  );
}
