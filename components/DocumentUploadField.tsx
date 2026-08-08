"use client";

import { useId, useRef, useState } from "react";

const DEFAULT_ACCEPTED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const DEFAULT_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MiB — debe coincidir con el límite del bucket
const DEFAULT_ACCEPT_ATTR = "image/jpeg,image/png,application/pdf";
const DEFAULT_BUTTON_LABEL = "Seleccionar archivo (JPG, PNG o PDF)";
const DEFAULT_TYPE_ERROR = "Formato no permitido. Usa JPG, PNG o PDF.";

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentUploadField({
  label,
  hint,
  value,
  onChange,
  required = true,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  maxSizeBytes = DEFAULT_MAX_SIZE_BYTES,
  acceptAttr = DEFAULT_ACCEPT_ATTR,
  buttonLabel = DEFAULT_BUTTON_LABEL,
  typeErrorMessage = DEFAULT_TYPE_ERROR,
}: {
  label: string;
  hint?: string;
  value: File | null;
  onChange: (file: File | null) => void;
  required?: boolean;
  /** MIME types aceptados -- debe coincidir con allowed_mime_types del bucket. */
  acceptedTypes?: string[];
  /** Límite de tamaño en bytes -- debe coincidir con file_size_limit del bucket. */
  maxSizeBytes?: number;
  /** Valor del atributo `accept` del <input type=file> nativo. */
  acceptAttr?: string;
  buttonLabel?: string;
  typeErrorMessage?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      onChange(null);
      return;
    }
    if (!acceptedTypes.includes(file.type)) {
      setLocalError(typeErrorMessage);
      onChange(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (file.size > maxSizeBytes) {
      setLocalError(`El archivo pesa más de ${Math.round(maxSizeBytes / (1024 * 1024))} MB.`);
      onChange(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setLocalError(null);
    onChange(file);
  }

  function handleRemove() {
    onChange(null);
    setLocalError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink/80">
        {label}
      </label>
      {hint && <p className="text-xs text-ink/50">{hint}</p>}

      {value ? (
        <div className="flex items-center justify-between rounded-md border border-line bg-white px-3.5 py-2.5">
          <span className="truncate text-sm text-ink/80">
            {value.name} <span className="text-ink/40">({formatSize(value.size)})</span>
          </span>
          <button
            type="button"
            onClick={handleRemove}
            className="ml-3 shrink-0 text-xs font-medium text-clay underline decoration-clay/30 underline-offset-2"
          >
            Quitar
          </button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className="flex cursor-pointer items-center justify-center rounded-md border border-dashed border-line bg-white px-3.5 py-4 text-center text-sm text-ink/50 transition hover:border-deep hover:text-deep"
        >
          {buttonLabel}
        </label>
      )}

      {/*
        Sin "required" en el input real: al estar oculto (className="hidden"),
        la validación nativa del navegador lo bloquearía sin dar ninguna
        pista visual de qué campo falta. La obligatoriedad ya se valida en
        JS antes de enviar (ver SignupRequestForm), mostrando un mensaje
        claro en su lugar.
      */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={acceptAttr}
        onChange={handleFileSelected}
        className="hidden"
      />

      {localError && (
        <p role="alert" className="text-xs text-clay">
          {localError}
        </p>
      )}
    </div>
  );
}
