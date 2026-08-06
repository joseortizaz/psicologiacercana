"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Plan } from "@/lib/types";
import { PlanForm } from "@/components/PlanForm";

function formatLimit(n: number | null) {
  return n === null ? "sin límite" : String(n);
}

function formatPrice(n: number | null, currency: string) {
  if (n === null) return "A medida";
  return `${currency} ${n.toLocaleString("es-DO", { minimumFractionDigits: 2 })}`;
}

function PlanCard({ plan, onChanged }: { plan: Plan; onChanged: () => void }) {
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  async function toggleActive() {
    setTogglingActive(true);
    const { error } = await supabase
      .from("plans")
      .update({ active: !plan.active })
      .eq("id", plan.id);
    setTogglingActive(false);
    if (error) {
      alert(`No se pudo actualizar: ${error.message}`);
      return;
    }
    onChanged();
  }

  if (editing) {
    return (
      <PlanForm
        plan={plan}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          onChanged();
        }}
      />
    );
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border border-line bg-white/60 p-6 ${
        !plan.active ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-lg text-deep">
            {plan.name}
            {!plan.active && (
              <span className="ml-2 rounded-full bg-ink/10 px-2 py-0.5 text-xs font-medium text-ink/50">
                Inactivo
              </span>
            )}
          </p>
          {plan.tagline && <p className="text-sm text-ink/50">{plan.tagline}</p>}
        </div>
        <p className="text-right font-display text-lg text-deep">
          {formatPrice(plan.monthly_price, plan.currency)}
          {plan.monthly_price !== null && <span className="text-xs text-ink/50">/mes</span>}
        </p>
      </div>

      <p className="text-sm text-ink/70">
        Límites: {formatLimit(plan.max_therapists)} terapeuta(s), {formatLimit(plan.max_org_admins)}{" "}
        administrador(es), {formatLimit(plan.max_assistants)} asistente(s),{" "}
        {formatLimit(plan.max_supervisors)} supervisor(es)
      </p>

      {plan.features.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm text-ink/60">
          {plan.features.map((f, i) => (
            <li key={i}>• {f}</li>
          ))}
        </ul>
      )}

      <div className="mt-1 flex items-center gap-4">
        <button
          onClick={() => setEditing(true)}
          className="text-sm font-medium text-deep underline decoration-deep/30 underline-offset-2"
        >
          Editar
        </button>
        <button
          onClick={toggleActive}
          disabled={togglingActive}
          className="text-sm font-medium text-ink/60 underline decoration-ink/20 underline-offset-2 hover:text-ink disabled:opacity-50"
        >
          {togglingActive ? "Guardando..." : plan.active ? "Desactivar" : "Activar"}
        </button>
      </div>
    </div>
  );
}

export function PlansManager({ initialPlans }: { initialPlans: Plan[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  function refresh() {
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink/50">
          Estos planes son los que ve el superadmin al asignar plan a una organización. Los
          precios/features del plan no se sincronizan automáticamente con el texto de la landing
          page — si cambias algo aquí, actualiza también components/LandingClient.tsx.
        </p>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="shrink-0 rounded-md bg-deep px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-deepLight"
          >
            Crear plan nuevo
          </button>
        )}
      </div>

      {creating && (
        <PlanForm
          onCancel={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            refresh();
          }}
        />
      )}

      {initialPlans.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-ink/50">
          Todavía no hay planes configurados.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {initialPlans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onChanged={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
