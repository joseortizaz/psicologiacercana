"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Patient, PatientCategory } from "@/lib/types";

const CATEGORY_OPTIONS: { value: PatientCategory; label: string }[] = [
  { value: "child", label: "Niño/a" },
  { value: "adolescent", label: "Adolescente" },
  { value: "adult", label: "Adulto" },
];

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4 first:border-0 first:pt-0">
      <p className="text-xs font-medium uppercase tracking-wide text-ink/40">{title}</p>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-ink/80">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  "rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep";

export function EditPatientForm({
  patient,
  assignableTherapists,
}: {
  patient: Patient;
  /** Si se da, se muestra un selector para reasignar el terapeuta responsable
   *  (uso desde org_admin y assistant). Si no se da (uso desde el panel de
   *  terapeuta), no se muestra ese campo, igual que en CreatePatientForm. */
  assignableTherapists?: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedTherapistId, setSelectedTherapistId] = useState(
    patient.primary_therapist_id ?? "",
  );
  const [fullName, setFullName] = useState(patient.full_name);
  const [dateOfBirth, setDateOfBirth] = useState(patient.date_of_birth);
  const [category, setCategory] = useState<PatientCategory>(patient.category);
  const [nationalId, setNationalId] = useState(patient.national_id ?? "");
  const [gender, setGender] = useState(patient.gender ?? "");
  const [contactPhone, setContactPhone] = useState(patient.contact_phone ?? "");
  const [contactEmail, setContactEmail] = useState(patient.contact_email ?? "");
  const [address, setAddress] = useState(patient.address ?? "");
  const [occupation, setOccupation] = useState(patient.occupation ?? "");
  const [educationLevel, setEducationLevel] = useState(patient.education_level ?? "");
  const [referredBy, setReferredBy] = useState(patient.referred_by ?? "");
  const [insuranceProvider, setInsuranceProvider] = useState(patient.insurance_provider ?? "");
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState(
    patient.insurance_policy_number ?? "",
  );
  const [guardianName, setGuardianName] = useState(patient.guardian_name ?? "");
  const [guardianRelationship, setGuardianRelationship] = useState(
    patient.guardian_relationship ?? "",
  );
  const [guardianPhone, setGuardianPhone] = useState(patient.guardian_phone ?? "");
  const [guardianNationalId, setGuardianNationalId] = useState(
    patient.guardian_national_id ?? "",
  );
  const [emergencyContactName, setEmergencyContactName] = useState(
    patient.emergency_contact_name ?? "",
  );
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    patient.emergency_contact_phone ?? "",
  );
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState(
    patient.emergency_contact_relationship ?? "",
  );
  const [active, setActive] = useState(patient.active);

  const showGuardianFields = category !== "adult";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const update: Record<string, unknown> = {
      full_name: fullName,
      date_of_birth: dateOfBirth,
      category,
      national_id: nationalId || null,
      gender: gender || null,
      contact_phone: contactPhone || null,
      contact_email: contactEmail || null,
      address: address || null,
      occupation: occupation || null,
      education_level: educationLevel || null,
      referred_by: referredBy || null,
      insurance_provider: insuranceProvider || null,
      insurance_policy_number: insurancePolicyNumber || null,
      guardian_name: guardianName || null,
      guardian_relationship: guardianRelationship || null,
      guardian_phone: guardianPhone || null,
      guardian_national_id: guardianNationalId || null,
      emergency_contact_name: emergencyContactName || null,
      emergency_contact_phone: emergencyContactPhone || null,
      emergency_contact_relationship: emergencyContactRelationship || null,
      active,
    };

    if (assignableTherapists) {
      update.primary_therapist_id = selectedTherapistId || null;
    }

    const { error: updateError } = await supabase
      .from("patients")
      .update(update)
      .eq("id", patient.id);

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-line px-4 py-2.5 text-sm font-medium text-ink/70 transition hover:border-deep/40 hover:text-ink"
      >
        Editar paciente
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-5 rounded-lg border border-line bg-white/60 p-6"
    >
      <p className="font-display text-lg text-deep">Editar paciente</p>

      <FieldGroup title="Datos básicos">
        <Field label="Nombre completo">
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputClass}
            placeholder="Nombre Apellido"
          />
        </Field>
        <Field label="Fecha de nacimiento">
          <input
            required
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Categoría">
          <select
            required
            value={category}
            onChange={(e) => setCategory(e.target.value as PatientCategory)}
            className={inputClass}
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Género (opcional)">
          <input
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Identificación (opcional)">
          <input
            value={nationalId}
            onChange={(e) => setNationalId(e.target.value)}
            className={inputClass}
            placeholder="CURP / DNI / etc."
          />
        </Field>
        {assignableTherapists && (
          <Field label="Terapeuta asignado (opcional)">
            <select
              value={selectedTherapistId}
              onChange={(e) => setSelectedTherapistId(e.target.value)}
              className={inputClass}
            >
              <option value="">Sin asignar</option>
              {assignableTherapists.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Estado">
          <select
            value={active ? "active" : "inactive"}
            onChange={(e) => setActive(e.target.value === "active")}
            className={inputClass}
          >
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </Field>
      </FieldGroup>

      <FieldGroup title="Contacto">
        <Field label="Teléfono">
          <input
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            className={inputClass}
            placeholder="55 1234 5678"
          />
        </Field>
        <Field label="Correo">
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className={inputClass}
            placeholder="paciente@ejemplo.com"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Dirección">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      </FieldGroup>

      {showGuardianFields && (
        <FieldGroup title="Tutor / responsable">
          <Field label="Nombre">
            <input
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Parentesco">
            <input
              value={guardianRelationship}
              onChange={(e) => setGuardianRelationship(e.target.value)}
              className={inputClass}
              placeholder="Madre, padre, tutor legal..."
            />
          </Field>
          <Field label="Teléfono">
            <input
              value={guardianPhone}
              onChange={(e) => setGuardianPhone(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Identificación">
            <input
              value={guardianNationalId}
              onChange={(e) => setGuardianNationalId(e.target.value)}
              className={inputClass}
            />
          </Field>
        </FieldGroup>
      )}

      <FieldGroup title="Contacto de emergencia">
        <Field label="Nombre">
          <input
            value={emergencyContactName}
            onChange={(e) => setEmergencyContactName(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Teléfono">
          <input
            value={emergencyContactPhone}
            onChange={(e) => setEmergencyContactPhone(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Parentesco">
          <input
            value={emergencyContactRelationship}
            onChange={(e) => setEmergencyContactRelationship(e.target.value)}
            className={inputClass}
          />
        </Field>
      </FieldGroup>

      <FieldGroup title="Seguro y otros datos">
        <Field label="Aseguradora">
          <input
            value={insuranceProvider}
            onChange={(e) => setInsuranceProvider(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="No. de póliza">
          <input
            value={insurancePolicyNumber}
            onChange={(e) => setInsurancePolicyNumber(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Ocupación">
          <input
            value={occupation}
            onChange={(e) => setOccupation(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Nivel educativo">
          <input
            value={educationLevel}
            onChange={(e) => setEducationLevel(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Referido por">
          <input
            value={referredBy}
            onChange={(e) => setReferredBy(e.target.value)}
            className={inputClass}
          />
        </Field>
      </FieldGroup>

      {error && (
        <p role="alert" className="text-sm text-clay">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-deep px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-deepLight disabled:opacity-60"
        >
          {loading ? "Guardando..." : "Guardar cambios"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-4 py-2.5 text-sm font-medium text-ink/60 transition hover:text-ink"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
