import { jsPDF } from "jspdf";
import type { Clinic, PrescriptionItem, PrescriptionRecord } from "@/lib/types";

// Receta ordinaria en A6 (105 × 148 mm) para imprimir. Cumple el contenido que
// pide el Decreto 665-12, art. 7: timbrado, fecha, paciente, por medicamento
// (nombre, concentración, forma, vía, posología, cantidad por toma y por día,
// duración) y datos del prescriptor. La firma y el sello se ponen a mano al
// imprimir: aquí solo se reserva el espacio. NO es firma electrónica.
//
// Los medicamentos controlados NO se imprimen: requieren el recetario oficial
// de la DNCD (Ley 50-88).

export const CONTROLLED_NOTICE =
  "Los medicamentos controlados deben prescribirse en el recetario oficial de la DNCD.";

export interface PrescriptionPrintContext {
  clinic: Pick<Clinic, "name" | "address" | "phone" | "email" | "logo_url"> | null;
  prescriber: { full_name: string; license_number: string | null; specialty: string | null };
  patientName: string;
}

const W = 105;
const H = 148;
const MX = 8;
const HEADER_BOTTOM_FIRST = 30;
const FOOTER_TOP = H - 33;

export function printableItems(record: PrescriptionRecord): PrescriptionItem[] {
  return (record.items ?? []).filter((it) => !it.is_controlled);
}

export function hasControlledItems(record: PrescriptionRecord): boolean {
  return (record.items ?? []).some((it) => it.is_controlled);
}

async function loadLogo(url: string | null): Promise<{ data: string; format: "PNG" | "JPEG" } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const format = blob.type === "image/png" ? "PNG" : blob.type === "image/jpeg" ? "JPEG" : null;
    if (!format) return null;
    const data: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return { data, format };
  } catch {
    // CORS o enlace roto: la receta se imprime solo con texto.
    return null;
  }
}

function itemLines(item: PrescriptionItem): { title: string; details: string[] } {
  const title = [item.medication_name, item.strength, item.dosage_form].filter(Boolean).join(" · ");
  const details: string[] = [];

  const structured = item.units_per_dose || item.units_per_day || item.route;
  if (structured) {
    const parts: string[] = [];
    if (item.route) parts.push(`Vía ${item.route.toLowerCase()}`);
    if (item.units_per_dose) parts.push(`${item.units_per_dose} por toma`);
    if (item.frequency) parts.push(item.frequency);
    if (item.units_per_day) parts.push(`${item.units_per_day} al día`);
    details.push(parts.join(" · "));
  } else {
    // Receta anterior a los campos estructurados: se conserva el texto libre.
    details.push([item.dosage, item.frequency].filter(Boolean).join(" · "));
  }
  if (item.duration) details.push(`Duración: ${item.duration}`);
  if (item.instructions) details.push(item.instructions);
  return { title, details };
}

export async function generatePrescriptionPdf(
  record: PrescriptionRecord,
  ctx: PrescriptionPrintContext,
): Promise<{ doc: jsPDF; filename: string }> {
  const items = printableItems(record);
  const logo = await loadLogo(ctx.clinic?.logo_url ?? null);

  const doc = new jsPDF({ unit: "mm", format: [W, H] });
  const contentWidth = W - MX * 2;
  const letterhead = ctx.clinic?.name?.trim() || ctx.prescriber.full_name;
  const issued = new Date(`${record.issued_at}T00:00:00`).toLocaleDateString("es-MX", {
    dateStyle: "long",
  });

  let y = 0;

  function drawHeader(first: boolean) {
    let textX = MX;
    if (logo) {
      try {
        doc.addImage(logo.data, logo.format, MX, 7, 14, 14);
        textX = MX + 17;
      } catch {
        // imagen no soportada: se omite
      }
    }
    doc.setTextColor(30, 41, 45);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const nameLines: string[] = doc.splitTextToSize(letterhead, W - MX - textX);
    doc.text(nameLines.slice(0, 2), textX, 10);
    let ty = 10 + Math.min(nameLines.length, 2) * 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(90, 90, 90);
    const contact = [ctx.clinic?.address, ctx.clinic?.phone, ctx.clinic?.email]
      .filter(Boolean)
      .join("  ·  ");
    if (contact) {
      const contactLines: string[] = doc.splitTextToSize(contact, W - MX - textX);
      doc.text(contactLines.slice(0, 2), textX, ty);
      ty += Math.min(contactLines.length, 2) * 2.8;
    }

    const lineY = Math.max(ty, logo ? 22 : 0) + 0.5;
    doc.setDrawColor(190, 190, 190);
    doc.line(MX, lineY, W - MX, lineY);
    y = lineY + 5;

    if (first) {
      doc.setTextColor(30, 41, 45);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(ctx.prescriber.full_name, MX, y);
      const nameWidth = doc.getTextWidth(ctx.prescriber.full_name);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(90, 90, 90);
      doc.text(`  ${ctx.prescriber.specialty?.trim() || "Psiquiatra"}`, MX + nameWidth, y);
      y += 5;

      doc.setFontSize(8);
      doc.setTextColor(30, 41, 45);
      doc.setFont("helvetica", "bold");
      doc.text("Paciente:", MX, y);
      doc.setFont("helvetica", "normal");
      const patientLines: string[] = doc.splitTextToSize(ctx.patientName, contentWidth - 16);
      doc.text(patientLines.slice(0, 2), MX + 16, y);
      y += 4 * Math.min(patientLines.length, 2);
      doc.setFont("helvetica", "bold");
      doc.text("Fecha:", MX, y);
      doc.setFont("helvetica", "normal");
      doc.text(issued, MX + 16, y);
      y += 5;

      doc.setFont("helvetica", "bolditalic");
      doc.setFontSize(11);
      doc.text("Rp/", MX, y);
      y += 4.5;
    } else {
      y = Math.max(y, HEADER_BOTTOM_FIRST - 6);
    }
  }

  function drawFooter() {
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      const sigY = FOOTER_TOP + 12;
      doc.setDrawColor(120, 120, 120);
      doc.setLineWidth(0.25);
      doc.line(MX, sigY, MX + 44, sigY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(90, 90, 90);
      doc.text("Firma", MX + 22, sigY + 3.5, { align: "center" });

      // Espacio para el sello (marco punteado)
      doc.setLineDashPattern([1, 1], 0);
      doc.rect(W - MX - 30, FOOTER_TOP + 0.5, 30, 14);
      doc.setLineDashPattern([], 0);
      doc.text("Sello", W - MX - 15, FOOTER_TOP + 18, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 45);
      doc.text(ctx.prescriber.full_name, MX, FOOTER_TOP + 22);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Exequátur No. ${ctx.prescriber.license_number?.trim() || "________________"}`,
        MX,
        FOOTER_TOP + 26,
      );
      doc.setFontSize(6);
      doc.setTextColor(110, 110, 110);
      doc.text("Válida por 30 días desde su emisión.", MX, FOOTER_TOP + 30);
      if (pages > 1) {
        doc.text(`Hoja ${p} de ${pages}`, W - MX, FOOTER_TOP + 30, { align: "right" });
      }
    }
  }

  function ensureSpace(needed: number) {
    if (y + needed > FOOTER_TOP - 2) {
      doc.addPage([W, H]);
      drawHeader(false);
    }
  }

  drawHeader(true);

  items.forEach((item, index) => {
    const { title, details } = itemLines(item);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    const titleLines: string[] = doc.splitTextToSize(`${index + 1}. ${title}`, contentWidth);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const detailLines: string[] = details.flatMap((d) => doc.splitTextToSize(d, contentWidth - 4));
    ensureSpace(titleLines.length * 3.8 + detailLines.length * 3.5 + 3);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 45);
    doc.text(titleLines, MX, y);
    y += titleLines.length * 3.8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(detailLines, MX + 4, y);
    y += detailLines.length * 3.5 + 3;
  });

  if (record.notes?.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const noteLines: string[] = doc.splitTextToSize(record.notes.trim(), contentWidth);
    ensureSpace(5 + noteLines.length * 3.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 45);
    doc.text("Indicaciones generales:", MX, y);
    y += 3.8;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text(noteLines, MX, y);
    y += noteLines.length * 3.5;
  }

  drawFooter();

  const safeName = ctx.patientName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return { doc, filename: `receta_${safeName}_${record.issued_at}.pdf` };
}
