"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { SignupRequest, SignupRequestStatus } from "@/lib/types";

const STATUS_LABELS: Record<SignupRequestStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
};

const STATUS_STYLES: Record<SignupRequestStatus, string> = {
  pending: "bg-clay/15 text-clay",
  approved: "bg-sage/20 text-deep",
  rejected: "bg-ink/10 text-ink/50",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type DocumentUrls = {
  idDocumentUrl: string | null;
  credentialDocumentUrl: string | null;
  licenseDocumentUrl: string | null;
};

function SignupRequestCard({
  request,
  onChanged,
}: {
  request: SignupRequest;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docs, setDocs] = useState<DocumentUrls | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadDocuments() {
    setLoadingDocs(true);
    setError(null);
    const { data, error: fnError } = await supabase.functions.invoke(
      "get-signup-document-urls",
      { body: { requestId: request.id } },
    );
    setLoadingDocs(false);
    if (fnError || data?.error) {
      setError(data?.error ?? fnError?.message ?? "No se pudieron obtener los documentos.");
      return;
    }
    setDocs(data as DocumentUrls);
  }

  async function handleApprove() {
    if (!confirm(`¿Aprobar la solicitud de ${request.full_name}? Se creará su cuenta y clínica.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: fnError } = await supabase.functions.invoke("review-signup-request", {
      body: { requestId: request.id, action: "approve" },
    });
    setBusy(false);
    if (fnError || data?.error) {
      setError(data?.error ?? fnError?.message ?? "No se pudo aprobar la solicitud.");
      return;
    }
    onChanged();
  }

  async function handleReject() {
    const reason = prompt("Motivo del rechazo (opcional):") ?? undefined;
    setBusy(true);
    setError(null);
    const { data, error: fnError } = await supabase.functions.invoke("review-signup-request", {
      body: { requestId: request.id, action: "reject", rejectionReason: reason },
    });
    setBusy(false);
    if (fnError || data?.error) {
      setError(data?.error ?? fnError?.message ?? "No se pudo rechazar la solicitud.");
      return;
    }
    onChanged();
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-white/60 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg text-deep">{request.full_name}</p>
          <p className="text-sm text-ink/60">{request.email}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[request.status]}`}
        >
          {STATUS_LABELS[request.status]}
        </span>
      </div>

      <div className="grid gap-1 text-sm text-ink/70 sm:grid-cols-2">
        <p>
          <span className="text-ink/50">Clínica/consultorio:</span> {request.clinic_name}
        </p>
        <p>
          <span className="text-ink/50">Teléfono:</span> {request.phone ?? "—"}
        </p>
        <p>
          <span className="text-ink/50">Exequátur/licencia:</span> {request.license_number ?? "—"}
        </p>
        <p>
          <span className="text-ink/50">Especialidad:</span> {request.specialty ?? "—"}
        </p>
        <p>
          <span className="text-ink/50">Solicitado:</span> {formatDate(request.created_at)}
        </p>
        {request.status !== "pending" && request.reviewed_at && (
          <p>
            <span className="text-ink/50">Revisado:</span> {formatDate(request.reviewed_at)}
          </p>
        )}
      </div>

      {request.status === "rejected" && request.rejection_reason && (
        <p className="text-sm text-clay">Motivo: {request.rejection_reason}</p>
      )}

      <div className="flex flex-col gap-2">
        {!docs ? (
          <button
            onClick={loadDocuments}
            disabled={loadingDocs}
            className="self-start text-sm font-medium text-deep underline decoration-deep/30 underline-offset-2 disabled:opacity-50"
          >
            {loadingDocs ? "Cargando documentos..." : "Ver documentos"}
          </button>
        ) : (
          <div className="flex flex-wrap gap-4 text-sm">
            {docs.idDocumentUrl && (
              <a
                href={docs.idDocumentUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-deep underline decoration-deep/30 underline-offset-2"
              >
                Documento de identidad
              </a>
            )}
            {docs.credentialDocumentUrl && (
              <a
                href={docs.credentialDocumentUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-deep underline decoration-deep/30 underline-offset-2"
              >
                Carnet/título
              </a>
            )}
            {docs.licenseDocumentUrl && (
              <a
                href={docs.licenseDocumentUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-deep underline decoration-deep/30 underline-offset-2"
              >
                Licencia/exequátur
              </a>
            )}
            <span className="text-xs text-ink/40">(los enlaces expiran en 5 minutos)</span>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-clay">
          {error}
        </p>
      )}

      {request.status === "pending" && (
        <div className="mt-1 flex gap-3">
          <button
            onClick={handleApprove}
            disabled={busy}
            className="rounded-md bg-deep px-4 py-2 text-sm font-medium text-paper transition hover:bg-deepLight disabled:opacity-60"
          >
            {busy ? "Procesando..." : "Aprobar"}
          </button>
          <button
            onClick={handleReject}
            disabled={busy}
            className="rounded-md px-4 py-2 text-sm font-medium text-clay underline decoration-clay/30 underline-offset-2 disabled:opacity-50"
          >
            Rechazar
          </button>
        </div>
      )}
    </div>
  );
}

export function SignupRequestsManager({ initialRequests }: { initialRequests: SignupRequest[] }) {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);

  function refresh() {
    router.refresh();
  }

  const visible = showAll
    ? initialRequests
    : initialRequests.filter((r) => r.status === "pending");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setShowAll(false)}
          className={`text-sm font-medium ${!showAll ? "text-deep" : "text-ink/50"}`}
        >
          Pendientes
        </button>
        <button
          onClick={() => setShowAll(true)}
          className={`text-sm font-medium ${showAll ? "text-deep" : "text-ink/50"}`}
        >
          Todas
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-ink/50">
          {showAll ? "Todavía no hay solicitudes." : "No hay solicitudes pendientes."}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map((request) => (
            <SignupRequestCard key={request.id} request={request} onChanged={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
