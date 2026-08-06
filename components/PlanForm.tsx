"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Plan } from "@/lib/types";

const inputClass =
  "rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-ink/80">{label}</label>
      {children}
    </div>
  );
}

function toLimitInput(n: number | null) {
  return n === null ? "" : String(n);
}

function parseLimit(v: string): number | null {
  const trimmed = v.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
}

function toPriceInput(n: number | null) {
  return n === null ? "" : String(n);
}

function parsePrice(v: string): number | null {
  const trimmed = v.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function PlanForm({
  plan,
  onSaved,
  onCancel,
}: {
  plan?: Plan;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const supabase = createClient();
  const isNew = !plan;

  const [code, setCode] = useState(plan?.code ?? "");
  const [name, setName] = useState(plan?.name ?? "");
  const [tagline, setTagline] = useState(plan?.tagline ?? "");
  const [isCustom, setIsCustom] = useState(plan?.is_custom ?? false);
  const [monthlyPrice, setMonthlyPrice] = useState(toPriceInput(plan?.monthly_price ?? null));
  const [annualPrice, setAnnualPrice] = useState(toPriceInput(plan?.annual_price ?? null));
  const [currency, setCurrency] = useState(plan?.currency ?? "DOP");
  const [maxTherapists, setMaxTherapists] = useState(toLimitInput(plan?.max_therapists ?? null));
  const [maxOrgAdmins, setMaxOrgAdmins] = useState(toLimitInput(plan?.max_org_admins ?? null));
  const [maxAssistants, setMaxAssistants] = useState(toLimitInput(plan?.max_assistants ?? null));
  const [maxSupervisors, setMaxSupervisors] = useState(toLimitInput(plan?.max_supervisors ?? null));
  const [features, setFeatures] = useState((plan?.features ?? []).join("\n"));
  const [displayOrder, setDisplayOrder] = useState(String(plan?.display_order ?? 0));
  const [active, setActive] = useState(plan?.active ?? true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      code: code.trim(),
      name: name.trim(),
      tagline: tagline.trim() || null,
      is_custom: isCustom,
      monthly_price: isCustom ? null : parsePrice(monthlyPrice),
      annual_price: isCustom ? null : parsePrice(annualPrice),
      currency: currency.trim() || "DOP",
      max_therapists: isCustom ? null : parseLimit(maxTherapists),
      max_org_admins: isCustom ? null : parseLimit(maxOrgAdmins),
      max_assistants: isCustom ? null : parseLimit(maxAssistants),
      max_supervisors: isCustom ? null : parseLimit(maxSupervisors),
      features: features
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean),
      display_order: Number(displayOrder) || 0,
      active,
    };

    const { error: saveError } = isNew
      ? await supabase.from("plans").insert(payload)
      : await supabase.from("plans").update(payload).eq("id", plan!.id);

    setLoading(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    onSaved();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-lg border border-line bg-white/60 p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Código (identificador interno)">
          <input
            required
            disabled={!isNew}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="esencial"
            className={`${inputClass} disabled:bg-paper disabled:text-ink/50`}
          />
        </Field>
        <Field label="Nombre comercial">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Esencial"
            className={inputClass}
          />
        </Field>
        <Field label="Tagline (opcional)">
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Terapeuta independiente"
            className={inputClass}
          />
        </Field>
        <Field label="Orden de despliegue">
          <input
            type="number"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-ink/80">
        <input
          type="checkbox"
          checked={isCustom}
          onChange={(e) => setIsCustom(e.target.checked)}
        />
        Plan a medida (sin precio fijo ni límites — ej. Institucional)
      </label>

      {!isCustom && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Precio mensual">
              <input
                type="number"
                min={0}
                step="0.01"
                value={monthlyPrice}
                onChange={(e) => setMonthlyPrice(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Precio anual">
              <input
                type="number"
                min={0}
                step="0.01"
                value={annualPrice}
                onChange={(e) => setAnnualPrice(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Moneda">
              <input
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Máx. terapeutas (vacío = sin límite)">
              <input
                type="number"
                min={0}
                value={maxTherapists}
                onChange={(e) => setMaxTherapists(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Máx. administradores">
              <input
                type="number"
                min={0}
                value={maxOrgAdmins}
                onChange={(e) => setMaxOrgAdmins(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Máx. asistentes">
              <input
                type="number"
                min={0}
                value={maxAssistants}
                onChange={(e) => setMaxAssistants(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Máx. supervisores">
              <input
                type="number"
                min={0}
                value={maxSupervisors}
                onChange={(e) => setMaxSupervisors(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </>
      )}

      <Field label="Features (una por línea)">
        <textarea
          rows={5}
          value={features}
          onChange={(e) => setFeatures(e.target.value)}
          className={inputClass}
          placeholder={"1 terapeuta\nExpediente clínico y agenda\nFirma digital de consentimientos"}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm font-medium text-ink/80">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Plan activo (visible para asignar a organizaciones)
      </label>

      {error && (
        <p role="alert" className="text-sm text-clay">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-deep px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-deepLight disabled:opacity-60"
        >
          {loading ? "Guardando..." : isNew ? "Crear plan" : "Guardar cambios"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-4 py-2.5 text-sm font-medium text-ink/60 transition hover:text-ink"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
