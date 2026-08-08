"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Botón para ver el PDF adjunto de una evaluación. Genera una signed URL de
 *  corta duración bajo la sesión del propio usuario -- Supabase Storage
 *  evalúa la policy de SELECT de storage.objects (equipo de atención +
 *  supervisor, ver 20260808020000_evaluation_reports.sql) antes de emitirla,
 *  así que solo funciona para quien ya tiene permiso de leer el archivo. */
export function EvaluationAttachmentLink({ path }: { path: string }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    const { data, error: signError } = await supabase.storage
      .from("evaluation-reports")
      .createSignedUrl(path, 60);

    setLoading(false);

    if (signError || !data?.signedUrl) {
      setError(signError?.message ?? "No se pudo generar el enlace al PDF.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mt-2 flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="self-start text-sm font-medium text-deep underline decoration-deep/30 underline-offset-2 disabled:opacity-60"
      >
        {loading ? "Abriendo..." : "Ver informe en PDF"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-clay">
          {error}
        </p>
      )}
    </div>
  );
}
