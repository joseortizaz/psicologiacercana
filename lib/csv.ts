// Utilidades de CSV sin dependencias externas: parseo (RFC4180 básico, con
// soporte de comillas/comas/saltos de línea escapados) y generación +
// descarga en el navegador.

/** Parsea un texto CSV a una matriz de filas de strings (sin interpretar
 *  tipos). Soporta campos entre comillas dobles, comas y saltos de línea
 *  dentro de comillas, y comillas escapadas ("" dentro de un campo citado). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  // Normaliza saltos de línea para no tener que distinguir \r\n de \n abajo.
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const char = src[i];

    if (inQuotes) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  // Última fila/campo si el archivo no termina en salto de línea.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Descarta filas completamente vacías (comunes al final de un CSV exportado
  // desde Excel/Sheets).
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

/** Convierte filas ya parseadas (con la primera fila como encabezados) a
 *  objetos `{ encabezado: valor }`, usando los encabezados tal cual vienen
 *  (recortados de espacios) como llaves. */
export function csvRowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      obj[header] = (row[idx] ?? "").trim();
    });
    return obj;
  });
}

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Genera texto CSV a partir de un arreglo de objetos y una lista de
 *  columnas `{ key, label }` (label se usa como encabezado). */
export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; label: string }[],
): string {
  const header = columns.map((c) => escapeCsvField(c.label)).join(",");
  const lines = rows.map((row) => columns.map((c) => escapeCsvField(row[c.key])).join(","));
  // BOM UTF-8 al inicio: sin esto, Excel en Windows suele mostrar mal los
  // acentos/ñ al abrir el CSV directamente.
  return "﻿" + [header, ...lines].join("\n");
}

/** Dispara la descarga de un archivo de texto (CSV) en el navegador. */
export function downloadTextFile(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
