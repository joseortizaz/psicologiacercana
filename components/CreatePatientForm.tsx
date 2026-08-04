"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { PatientCategory } from "@/lib/types";

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

export function CreatePatientForm({
  organizationId,
  clinicId,
  therapistId,
  createdBy,
  assignableTherapists,
  assignableClinics,
}: {
  organizationId: string;
  /** Clínica fija (uso desde assistant/therapist, que operan en una sola clínica). */
  clinicId?: string;
  /** Terapeuta fijo a asignar (uso desde el panel de terapeuta: se asigna a sí mismo). */
  therapistId?: string;
  /** Usuario que crea el registro. Si no se da, se usa therapistId (comportamiento previo). */
  createdBy?: string;
  /** Si se da, se muestra un selector de terapeuta en vez de asignar therapistId fijo
   *  (uso desde el panel de assistant, que no es terapeuta y asigna en nombre de otro).
   *  Si además trae clinic_id, se filtra según la clínica seleccionada (uso desde org_admin). */
  assignableTherapists?: { id: string; full_name: string; clinic_id?: string }[];
  /** Si se da, se muestra un selector de clínica en vez de usar clinicId fijo
   *  (uso desde el panel de org_admin, que gestiona varias clínicas). */
  assignableClinics?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTherapistId, setSelectedTherapistId] = useState(therapistId ?? "");
  const [selectedClinicId, setSelectedClinicId] = useState(
    clinicId ?? assignableClinics?.[0]?.id ?? "",
  );

  const therapistOptions = assignableClinics
    ? (assignableTherapists ?? []).filter(
        (t) => !t.clinic_id || t.clinic_id === selectedClinicId,
      )
    : (assignableTherapists ?? []);

  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [category, setCategory] = useState<PatientCategory>("adult");
  const [nationalId, setNationalId] = useState("");
  const [gender, setGender] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [address, setAddress] = useState("");
  const [occupation, setOccupation] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [referredBy, setReferredBy] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianNationalId, setGuardianNationalId] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState("");

  const showGuardianFields = category !== "adult";

  function reset() {
    setFullName("");
    setDateOfBirth("");
    setCategory("adult");
    setNationalId("");
    setGender("");
    setContactPhone("");
    setContactEmail("");
    setAddress("");
    setOccupation("");
    setEducationLevel("");
    setReferredBy("");
    setInsuranceProvider("");
    setInsurancePolicyNumber("");
    setGuardianName("");
    setGuardianRelationship("");
    setGuardianPhone("");
    setGuardianNationalId("");
    setEmergencyContactName("");
    setEmergencyContactPhone("");
    setEmergencyContactRelationship("");
    setSelectedTherapistId(therapistId ?? "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: insertError } = await supabase.from("patients").insert({
      organization_id: organizationId,
      clinic_id: selectedClinicId,
      primary_therapist_id: selectedTherapistId || null,
      created_by: createdBy ?? therapistId ?? null,
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
      active: true,
    });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setOpen(false);
    reset();
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-deep px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-deepLight"
      >
        Agregar paciente
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-lg border border-line bg-white/60 p-6"
    >
      <p className="font-display text-lg text-deep">Agregar paciente</p>

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
        {assignableClinics && (
          <Field label="Sucursal">
            <select
              required
              value={selectedClinicId}
              onChange={(e) => {
                setSelectedClinicId(e.target.value);
                setSelectedTherapistId("");
              }}
              className={inputClass}
            >
              {assignableClinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {assignableTherapists && (
          <Field label="Terapeuta asignado (opcional)">
            <select
              value={selectedTherapistId}
              onChange={(e) => setSelectedTherapistId(e.target.value)}
              className={inputClass}
            >
              <option value="">Sin asignar</option>
              {therapistOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
          </Field>
        )}
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
          {loading ? "Guardando..." : "Guardar paciente"}
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
