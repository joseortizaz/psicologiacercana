"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";
import { isValidPhone } from "@/lib/phone";

const CLINICAL_ROLES: UserRole[] = ["therapist", "supervisor"];

export function UpdateProfileForm({
  role,
  initialFullName,
  initialPhone,
  initialWhatsapp,
  initialLicenseNumber,
  initialSpecialty,
}: {
  role: UserRole;
  initialFullName: string;
  initialPhone: string | null;
  initialWhatsapp: string | null;
  initialLicenseNumber: string | null;
  initialSpecialty: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState(initialFullName);
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [whatsapp, setWhatsapp] = useState(initialWhatsapp ?? "");
  const [licenseNumber, setLicenseNumber] = useState(initialLicenseNumber ?? "");
  const [specialty, setSpecialty] = useState(initialSpecialty ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const showClinicalFields = CLINICAL_ROLES.includes(role);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (whatsapp.trim() && !isValidPhone(whatsapp)) {
      setError("El número de WhatsApp debe tener entre 10 y 15 dígitos.");
      return;
    }
    setLoading(true);

    const { error: rpcError } = await supabase.rpc("update_own_profile", {
      p_full_name: fullName,
      p_phone: phone || null,
      p_whatsapp_number: whatsapp,
      p_license_number: showClinicalFields ? licenseNumber || null : null,
      p_specialty: showClinicalFields ? specialty || null : null,
    });

    setLoading(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} data-allow-when-locked className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Nombre completo</label>
        <input
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">Teléfono</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep"
          placeholder="Opcional"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink/80">WhatsApp</label>
        <input
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          className="rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep"
          placeholder="Para que podamos comunicarnos contigo"
        />
      </div>

      {showClinicalFields && (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink/80">Cédula profesional</label>
            <input
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              className="rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep"
              placeholder="Opcional"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink/80">Especialidad</label>
            <input
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep"
              placeholder="Opcional"
            />
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-clay">
          {error}
        </p>
      )}
      {success && <p className="text-sm text-sage">Cambios guardados.</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-1 self-start rounded-md bg-deep px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-deepLight disabled:opacity-60"
      >
        {loading ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
