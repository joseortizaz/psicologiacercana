"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AppointmentStatus } from "@/lib/types";

export function AppointmentStatusButtons({
  appointmentId,
  status,
}: {
  appointmentId: string;
  status: AppointmentStatus;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState<string | null>(null);

  async function updateStatus(next: AppointmentStatus) {
    setLoading(next);

    const payload: Record<string, unknown> = { status: next };
    if (next === "cancelled") {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      payload.cancelled_at = new Date().toISOString();
      payload.cancelled_by = user?.id ?? null;
    }

    const { error } = await supabase.from("appointments").update(payload).eq("id", appointmentId);
    setLoading(null);

    if (!error) {
      router.refresh();
    }
  }

  if (status !== "scheduled" && status !== "confirmed") {
    return null;
  }

  return (
    <div className="flex gap-2">
      {status === "scheduled" && (
        <button
          onClick={() => updateStatus("confirmed")}
          disabled={loading !== null}
          className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink/70 transition hover:border-deep hover:text-deep disabled:opacity-50"
        >
          {loading === "confirmed" ? "..." : "Confirmar"}
        </button>
      )}
      <button
        onClick={() => updateStatus("completed")}
        disabled={loading !== null}
        className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink/70 transition hover:border-sage hover:text-sage disabled:opacity-50"
      >
        {loading === "completed" ? "..." : "Completada"}
      </button>
      <button
        onClick={() => updateStatus("no_show")}
        disabled={loading !== null}
        className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink/70 transition hover:border-clay hover:text-clay disabled:opacity-50"
      >
        {loading === "no_show" ? "..." : "No asistió"}
      </button>
      <button
        onClick={() => updateStatus("cancelled")}
        disabled={loading !== null}
        className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink/70 transition hover:border-clay hover:text-clay disabled:opacity-50"
      >
        {loading === "cancelled" ? "..." : "Cancelar"}
      </button>
    </div>
  );
}
