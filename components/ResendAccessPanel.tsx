"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface AccessUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  org_admin: "Administrador",
  therapist: "Psicólogo",
  psychiatrist: "Psiquiatra",
  assistant: "Asistente",
  supervisor: "Supervisor",
};

export function ResendAccessPanel({ users }: { users: AccessUser[] }) {
  const supabase = createClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, { ok: boolean; text: string }>>({});

  async function resend(user: AccessUser) {
    setBusyId(user.id);
    setMessages((m) => {
      const { [user.id]: _removed, ...rest } = m;
      return rest;
    });

    const { data, error } = await supabase.functions.invoke("resend-access", {
      body: { userId: user.id },
    });

    // Si la función responde con error HTTP, el detalle viene en el cuerpo.
    let detail: string | null = null;
    if (error) {
      try {
        const body = await (error as { context?: Response }).context?.json();
        detail = body?.error ?? null;
      } catch {
        detail = null;
      }
    }

    setBusyId(null);
    setMessages((m) => ({
      ...m,
      [user.id]:
        error || !data?.ok
          ? { ok: false, text: detail ?? error?.message ?? "No se pudo reenviar el acceso." }
          : { ok: true, text: `Enlace enviado a ${data.sentTo}.` },
    }));
  }

  if (users.length === 0) return null;

  return (
    <section className="rounded-lg border border-line bg-white/60 p-6">
      <p className="font-display text-lg text-deep">Acceso de los usuarios</p>
      <p className="mt-1 text-xs text-ink/50">
        Si la invitación caducó o no llegó, reenvía un enlace nuevo para crear la contraseña. El
        enlace es de un solo uso y vence pronto.
      </p>
      <ul className="mt-4 flex flex-col divide-y divide-line">
        {users.map((u) => (
          <li key={u.id} className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-medium text-ink">{u.full_name}</p>
              <p className="text-ink/60">
                {u.email} · {ROLE_LABELS[u.role] ?? u.role}
              </p>
              {messages[u.id] && (
                <p
                  role={messages[u.id].ok ? "status" : "alert"}
                  className={`mt-1 text-xs ${messages[u.id].ok ? "text-sage" : "text-clay"}`}
                >
                  {messages[u.id].text}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => resend(u)}
              disabled={busyId === u.id}
              className="self-start rounded-md border border-deep px-3 py-1.5 text-sm font-medium text-deep transition hover:bg-deep hover:text-paper disabled:opacity-60"
            >
              {busyId === u.id ? "Enviando..." : "Reenviar acceso"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
