"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { parseCsv, csvRowsToObjects, toCsv, downloadTextFile } from "@/lib/csv";
import type { ConsultationModality, ConsultationSessionType } from "@/lib/types";

const TEMPLATE_COLUMNS = [
  "patient_identifier",
  "therapist_email",
  "start_time",
  "duration_minutes",
  "modality",
  "session_type",
  "reason",
].map((key) => ({ key, label: key }));

const MODALITY_VALUES: ConsultationModality[] = ["in_person", "virtual", "phone"];
const SESSION_TYPE_VALUES: ConsultationSessionType[] = ["individual", "family", "couple", "group"];

interface ParsedRow {
  raw: Record<string, string>;
  lineNumber: number;
  errors: string[];
}

function validateRow(raw: Record<string, string>, lineNumber: number, requireTherapistEmail: boolean): ParsedRow {
  const errors: string[] = [];
  if (!raw.patient_identifier?.trim()) {
    errors.push("patient_identifier es obligatorio (identificación, correo o nombre completo exacto)");
  }
  if (requireTherapistEmail && !raw.therapist_email?.trim()) {
    errors.push("therapist_email es obligatorio");
  }
  const start = raw.start_time?.trim();
  if (!start) {
    errors.push("start_time es obligatorio");
  } else if (Number.isNaN(new Date(start.replace(" ", "T")).getTime())) {
    errors.push("start_time no es una fecha/hora válida (usa AAAA-MM-DD HH:MM)");
  }
  if (raw.duration_minutes?.trim() && Number.isNaN(Number(raw.duration_minutes.trim()))) {
    errors.push("duration_minutes debe ser un número");
  }
  const modality = raw.modality?.trim();
  if (modality && !MODALITY_VALUES.includes(modality as ConsultationModality)) {
    errors.push("modality debe ser in_person/virtual/phone");
  }
  const sessionType = raw.session_type?.trim();
  if (sessionType && !SESSION_TYPE_VALUES.includes(sessionType as ConsultationSessionType)) {
    errors.push("session_type debe ser individual/family/couple/group");
  }
  return { raw, lineNumber, errors };
}

export function ImportAppointmentsCsv({
  organizationId,
  clinicId,
  therapistId,
  assignableClinics,
}: {
  organizationId: string;
  /** Clínica fija (uso desde assistant/therapist). */
  clinicId?: string;
  /** Terapeuta fijo: uso desde el panel de terapeuta, agenda solo para sí mismo
   *  (la columna therapist_email del CSV se ignora en ese caso). */
  therapistId?: string;
  /** Selector de clínica para org_admin, que gestiona varias. */
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
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: number; failed: { line: number; message: string }[] } | null>(
    null,
  );
  const [parseError, setParseError] = useState<string | null>(null);

  const requireTherapistEmail = !therapistId;

  function downloadTemplate() {
    const csv = toCsv([], TEMPLATE_COLUMNS);
    downloadTextFile("plantilla_citas.csv", csv);
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
        setRows(parsed.map((raw, idx) => validateRow(raw, idx + 2, requireTherapistEmail)));
      } catch {
        setParseError("No se pudo leer el archivo. Verifica que sea un CSV válido.");
        setRows([]);
      }
    };
    reader.readAsText(file, "utf-8");
  }

  async function resolvePatientId(identifier: string): Promise<{ id: string } | { error: string }> {
    const trimmed = identifier.trim();
    const { data, error } = await supabase
      .from("patients")
      .select("id, full_name")
      .eq("clinic_id", selectedClinicId)
      .or(`national_id.eq.${trimmed},contact_email.eq.${trimmed},full_name.eq.${trimmed}`)
      .limit(2);

    if (error) return { error: error.message };
    if (!data || data.length === 0) return { error: `no se encontró un paciente para "${trimmed}"` };
    if (data.length > 1) {
      return { error: `"${trimmed}" coincide con más de un paciente; usa identificación o correo` };
    }
    return { id: data[0].id };
  }

  async function resolveTherapistId(email: string): Promise<{ id: string } | { error: string }> {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("clinic_id", selectedClinicId)
      .eq("role", "therapist")
      .eq("email", email.trim())
      .maybeSingle();

    if (error) return { error: error.message };
    if (!data) return { error: `no se encontró un terapeuta activo con correo "${email.trim()}"` };
    return { id: data.id };
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

      const patientResult = await resolvePatientId(raw.patient_identifier);
      if ("error" in patientResult) {
        failed.push({ line: row.lineNumber, message: patientResult.error });
        continue;
      }

      let resolvedTherapistId = therapistId ?? "";
      if (!therapistId) {
        const therapistResult = await resolveTherapistId(raw.therapist_email);
        if ("error" in therapistResult) {
          failed.push({ line: row.lineNumber, message: therapistResult.error });
          continue;
        }
        resolvedTherapistId = therapistResult.id;
      }

      const start = new Date(raw.start_time.trim().replace(" ", "T"));
      const duration = raw.duration_minutes?.trim() ? Number(raw.duration_minutes.trim()) : 50;
      const end = new Date(start.getTime() + duration * 60000);

      const { error } = await supabase.from("appointments").insert({
        organization_id: organizationId,
        clinic_id: selectedClinicId,
        therapist_id: resolvedTherapistId,
        patient_id: patientResult.id,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        modality: (raw.modality?.trim() || "in_person") as ConsultationModality,
        session_type: (raw.session_type?.trim() || "individual") as ConsultationSessionType,
        reason: raw.reason?.trim() || null,
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
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-white/60 p-6">
      <div className="flex items-center justify-between">
        <p className="font-display text-lg text-deep">Importar citas desde CSV</p>
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
        <button type="button" onClick={downloadTemplate} className="font-medium text-deep underline">
          Descargar plantilla vacía
        </button>
        . <code className="text-xs">patient_identifier</code> puede ser la identificación, el correo o el
        nombre completo exacto del paciente.
        {requireTherapistEmail && (
          <>
            {" "}
            <code className="text-xs">therapist_email</code> es obligatorio (correo del terapeuta ya
            registrado en la clínica).
          </>
        )}{" "}
        <code className="text-xs">start_time</code> en formato AAAA-MM-DD HH:MM.
      </p>

      {assignableClinics && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink/80">Sucursal para todas las filas</label>
          <select
            value={selectedClinicId}
            onChange={(e) => setSelectedClinicId(e.target.value)}
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
            {fileName}: <span className="font-medium text-sage">{validCount} fila(s) con formato válido</span>
            {invalidRows.length > 0 && (
              <>
                {" · "}
                <span className="font-medium text-clay">{invalidRows.length} con errores de formato</span>
              </>
            )}
          </p>
          <p className="text-xs text-ink/40">
            La búsqueda de paciente y terapeuta se hace al importar; si alguno no se encuentra, esa fila se
            reporta como error sin afectar al resto.
          </p>

          {invalidRows.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-md border border-clay/30 bg-clay/5 p-3">
              <ul className="flex flex-col gap-1 text-xs text-clay">
                {invalidRows.map((r) => (
                  <li key={r.lineNumber}>
                    Línea {r.lineNumber}: {r.errors.join("; ")}
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
              {importing ? "Importando..." : `Importar ${validCount} cita(s)`}
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
            {result.ok} cita(s) importada(s) correctamente
            {result.failed.length > 0 ? `, ${result.failed.length} con error` : ""}.
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
