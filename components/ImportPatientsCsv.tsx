"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { parseCsv, csvRowsToObjects, toCsv, downloadTextFile } from "@/lib/csv";
import type { PatientCategory } from "@/lib/types";

const TEMPLATE_COLUMNS: { key: string; label: string }[] = [
  { key: "full_name", label: "full_name" },
  { key: "date_of_birth", label: "date_of_birth" },
  { key: "category", label: "category" },
  { key: "national_id", label: "national_id" },
  { key: "gender", label: "gender" },
  { key: "contact_phone", label: "contact_phone" },
  { key: "contact_email", label: "contact_email" },
  { key: "address", label: "address" },
  { key: "occupation", label: "occupation" },
  { key: "education_level", label: "education_level" },
  { key: "referred_by", label: "referred_by" },
  { key: "insurance_provider", label: "insurance_provider" },
  { key: "insurance_policy_number", label: "insurance_policy_number" },
  { key: "guardian_name", label: "guardian_name" },
  { key: "guardian_relationship", label: "guardian_relationship" },
  { key: "guardian_phone", label: "guardian_phone" },
  { key: "guardian_national_id", label: "guardian_national_id" },
  { key: "emergency_contact_name", label: "emergency_contact_name" },
  { key: "emergency_contact_phone", label: "emergency_contact_phone" },
  { key: "emergency_contact_relationship", label: "emergency_contact_relationship" },
];

const CATEGORY_ALIASES: Record<string, PatientCategory> = {
  child: "child",
  "niño": "child",
  "nina": "child",
  "niña": "child",
  nino: "child",
  adolescent: "adolescent",
  adolescente: "adolescent",
  adult: "adult",
  adulto: "adult",
};

interface ParsedRow {
  raw: Record<string, string>;
  lineNumber: number;
  errors: string[];
}

function validateRow(raw: Record<string, string>, lineNumber: number): ParsedRow {
  const errors: string[] = [];
  if (!raw.full_name?.trim()) errors.push("full_name es obligatorio");
  if (!raw.date_of_birth?.trim()) {
    errors.push("date_of_birth es obligatorio");
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.date_of_birth.trim())) {
    errors.push("date_of_birth debe tener formato AAAA-MM-DD");
  }
  const categoryKey = raw.category?.trim().toLowerCase();
  if (!categoryKey || !CATEGORY_ALIASES[categoryKey]) {
    errors.push("category debe ser child/adolescent/adult (o niño/adolescente/adulto)");
  }
  if (raw.contact_email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.contact_email.trim())) {
    errors.push("contact_email no parece un correo válido");
  }
  return { raw, lineNumber, errors };
}

export function ImportPatientsCsv({
  organizationId,
  clinicId,
  therapistId,
  createdBy,
  assignableTherapists,
  assignableClinics,
}: {
  organizationId: string;
  clinicId?: string;
  therapistId?: string;
  createdBy?: string;
  assignableTherapists?: { id: string; full_name: string; clinic_id?: string }[];
  assignableClinics?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [selectedClinicId, setSelectedClinicId] = useState(
    clinicId ?? assignableClinics?.[0]?.id ?? "",
  );
  const [selectedTherapistId, setSelectedTherapistId] = useState(therapistId ?? "");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: number; failed: { line: number; message: string }[] } | null>(
    null,
  );
  const [parseError, setParseError] = useState<string | null>(null);

  const therapistOptions = assignableClinics
    ? (assignableTherapists ?? []).filter((t) => !t.clinic_id || t.clinic_id === selectedClinicId)
    : (assignableTherapists ?? []);

  function downloadTemplate() {
    const csv = toCsv([], TEMPLATE_COLUMNS.map((c) => ({ key: c.key, label: c.label })));
    downloadTextFile("plantilla_pacientes.csv", csv);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setParseError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const parsed = csvRowsToObjects(parseCsv(text));
        if (parsed.length === 0) {
          setParseError("El archivo no tiene filas de datos (¿solo trae encabezados?).");
          setRows([]);
          return;
        }
        setRows(parsed.map((raw, idx) => validateRow(raw, idx + 2)));
      } catch {
        setParseError("No se pudo leer el archivo. Verifica que sea un CSV válido.");
        setRows([]);
      }
    };
    reader.readAsText(file, "utf-8");
  }

  async function handleImport() {
    const validRows = rows.filter((r) => r.errors.length === 0);
    if (validRows.length === 0) return;
    setImporting(true);
    setResult(null);

    let ok = 0;
    const failed: { line: number; message: string }[] = [];

    for (const row of validRows) {
      const raw = row.raw;
      const category = CATEGORY_ALIASES[raw.category.trim().toLowerCase()];
      const { error } = await supabase.from("patients").insert({
        organization_id: organizationId,
        clinic_id: selectedClinicId,
        primary_therapist_id: selectedTherapistId || null,
        created_by: createdBy ?? therapistId ?? null,
        full_name: raw.full_name.trim(),
        date_of_birth: raw.date_of_birth.trim(),
        category,
        national_id: raw.national_id?.trim() || null,
        gender: raw.gender?.trim() || null,
        contact_phone: raw.contact_phone?.trim() || null,
        contact_email: raw.contact_email?.trim() || null,
        address: raw.address?.trim() || null,
        occupation: raw.occupation?.trim() || null,
        education_level: raw.education_level?.trim() || null,
        referred_by: raw.referred_by?.trim() || null,
        insurance_provider: raw.insurance_provider?.trim() || null,
        insurance_policy_number: raw.insurance_policy_number?.trim() || null,
        guardian_name: raw.guardian_name?.trim() || null,
        guardian_relationship: raw.guardian_relationship?.trim() || null,
        guardian_phone: raw.guardian_phone?.trim() || null,
        guardian_national_id: raw.guardian_national_id?.trim() || null,
        emergency_contact_name: raw.emergency_contact_name?.trim() || null,
        emergency_contact_phone: raw.emergency_contact_phone?.trim() || null,
        emergency_contact_relationship: raw.emergency_contact_relationship?.trim() || null,
        active: true,
      });

      if (error) {
        failed.push({ line: row.lineNumber, message: error.message });
      } else {
        ok++;
      }
    }

    setImporting(false);
    setResult({ ok, failed });
    if (ok > 0) router.refresh();
  }

  function reset() {
    setRows([]);
    setFileName("");
    setResult(null);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink/70 transition hover:border-deep/40 hover:text-ink"
      >
        Importar CSV
      </button>
    );
  }

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const invalidRows = rows.filter((r) => r.errors.length > 0);

  return (
    <div className="flex w-full flex-col gap-4 rounded-lg border border-line bg-white/60 p-6">
      <div className="flex items-center justify-between">
        <p className="font-display text-lg text-deep">Importar pacientes desde CSV</p>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          className="text-sm text-ink/50 hover:text-ink"
        >
          Cerrar
        </button>
      </div>

      <p className="text-sm text-ink/60">
        El CSV debe traer encabezados en inglés (nombres de columna de la base de datos).{" "}
        <button type="button" onClick={downloadTemplate} className="font-medium text-deep underline">
          Descargar plantilla vacía
        </button>
        . Columnas obligatorias: <code className="text-xs">full_name</code>,{" "}
        <code className="text-xs">date_of_birth</code> (AAAA-MM-DD), <code className="text-xs">category</code>{" "}
        (child/adolescent/adult).
      </p>

      {assignableClinics && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink/80">Sucursal para todas las filas</label>
          <select
            value={selectedClinicId}
            onChange={(e) => {
              setSelectedClinicId(e.target.value);
              setSelectedTherapistId("");
            }}
            className="rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep sm:max-w-xs"
          >
            {assignableClinics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {assignableTherapists && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink/80">
            Terapeuta a asignar a todas las filas (opcional)
          </label>
          <select
            value={selectedTherapistId}
            onChange={(e) => setSelectedTherapistId(e.target.value)}
            className="rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep sm:max-w-xs"
          >
            <option value="">Sin asignar</option>
            {therapistOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Archivo CSV</label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="text-sm text-ink/70"
        />
      </div>

      {parseError && <p className="text-sm text-clay">{parseError}</p>}

      {rows.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink/70">
            {fileName}: <span className="font-medium text-sage">{validCount} fila(s) válidas</span>
            {invalidRows.length > 0 && (
              <>
                {" · "}
                <span className="font-medium text-clay">{invalidRows.length} con errores</span>
              </>
            )}
          </p>

          {invalidRows.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-md border border-clay/30 bg-clay/5 p-3">
              <ul className="flex flex-col gap-1 text-xs text-clay">
                {invalidRows.map((r) => (
                  <li key={r.lineNumber}>
                    Línea {r.lineNumber} ({r.raw.full_name || "sin nombre"}): {r.errors.join("; ")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || validCount === 0 || (assignableClinics ? !selectedClinicId : false)}
              className="rounded-md bg-deep px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-deepLight disabled:opacity-60"
            >
              {importing ? "Importando..." : `Importar ${validCount} paciente(s)`}
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-md px-4 py-2.5 text-sm font-medium text-ink/60 transition hover:text-ink"
            >
              Elegir otro archivo
            </button>
          </div>
        </div>
      )}

      {result && (
        <div
          className={`rounded-md border p-4 text-sm ${
            result.failed.length === 0
              ? "border-sage/40 bg-sage/10 text-sage"
              : "border-amber-500/30 bg-amber-500/10 text-amber-700"
          }`}
        >
          <p className="font-medium">
            {result.ok} paciente(s) importado(s) correctamente
            {result.failed.length > 0 ? `, ${result.failed.length} con error al guardar` : ""}.
          </p>
          {result.failed.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-xs">
              {result.failed.map((f) => (
                <li key={f.line}>
                  Línea {f.line}: {f.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
