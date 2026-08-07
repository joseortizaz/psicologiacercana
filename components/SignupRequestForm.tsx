"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DocumentUploadField } from "@/components/DocumentUploadField";
import { extractFunctionErrorMessage } from "@/lib/functionError";

type UploadSlot = { path: string; token: string; signedUrl: string };

type UploadSlotsResponse = {
  requestId: string;
  idDocument: UploadSlot;
  credentialDocument: UploadSlot;
  licenseDocument: UploadSlot;
};

export function SignupRequestForm() {
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [clinicName, setClinicName] = useState("");

  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [credentialDocument, setCredentialDocument] = useState<File | null>(null);
  const [licenseDocument, setLicenseDocument] = useState<File | null>(null);

  const [step, setStep] = useState<"idle" | "uploading" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const loading = step !== "idle";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!idDocument || !credentialDocument || !licenseDocument) {
      setError("Debes adjuntar los 3 documentos.");
      return;
    }

    // 1. Pedir URLs firmadas de carga para los 3 documentos.
    setStep("uploading");
    const { data: slotsData, error: slotsError } = await supabase.functions.invoke(
      "create-signup-upload-slots",
      { body: {} },
    );

    if (slotsError || slotsData?.error) {
      setStep("idle");
      setError(slotsData?.error ?? (await extractFunctionErrorMessage(slotsError)));
      return;
    }

    const slots = slotsData as UploadSlotsResponse;

    // 2. Subir cada documento directo a Storage con su URL firmada.
    const uploads = [
      { file: idDocument, slot: slots.idDocument },
      { file: credentialDocument, slot: slots.credentialDocument },
      { file: licenseDocument, slot: slots.licenseDocument },
    ];

    for (const { file, slot } of uploads) {
      const { error: uploadError } = await supabase.storage
        .from("signup-documents")
        .uploadToSignedUrl(slot.path, slot.token, file, { contentType: file.type });

      if (uploadError) {
        setStep("idle");
        setError(`No se pudo subir "${file.name}": ${uploadError.message}`);
        return;
      }
    }

    // 3. Confirmar la solicitud con los datos del profesional.
    setStep("submitting");
    const { data: submitData, error: submitError } = await supabase.functions.invoke(
      "submit-signup-request",
      {
        body: {
          requestId: slots.requestId,
          fullName,
          email,
          phone: phone || undefined,
          licenseNumber,
          specialty: specialty || undefined,
          clinicName,
        },
      },
    );

    setStep("idle");

    if (submitError || submitData?.error) {
      setError(submitData?.error ?? (await extractFunctionErrorMessage(submitError)));
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4 text-sm text-ink/80">
        <p>
          ¡Listo! Recibimos tu solicitud de prueba gratuita. Un administrador va a revisar tus
          documentos y, si todo está en orden, te enviaremos un correo a{" "}
          <span className="font-medium text-ink">{email}</span> para que crees tu contraseña y
          empieces a usar Cercana.
        </p>
        <Link
          href="/"
          className="text-sm font-medium text-deep underline decoration-deep/30 underline-offset-2"
        >
          ← Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink/80">Nombre completo</label>
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep"
            placeholder="Nombre Apellido"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink/80">Correo electrónico</label>
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep"
            placeholder="tucorreo@ejemplo.com"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink/80">Teléfono</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep"
            placeholder="+1 809 000 0000"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink/80">Número de exequátur / licencia</label>
          <input
            required
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
            className="rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep"
            placeholder="Ej. EXQ-00000"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink/80">Especialidad</label>
          <input
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            className="rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep"
            placeholder="Ej. Psicología clínica"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink/80">Nombre de tu clínica o consultorio</label>
          <input
            required
            value={clinicName}
            onChange={(e) => setClinicName(e.target.value)}
            className="rounded-md border border-line bg-white px-3.5 py-2.5 outline-none focus:border-deep"
            placeholder="Puede ser tu propio nombre, si ejerces de forma independiente"
          />
        </div>
      </div>

      <hr className="border-line" />

      <div>
        <p className="text-sm font-medium text-ink/80">Documentos requeridos</p>
        <p className="mt-1 text-xs text-ink/50">
          Formatos aceptados: JPG, PNG o PDF. Máximo 10 MB por archivo. Un administrador los
          revisará antes de activar tu cuenta.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <DocumentUploadField
          label="Documento de identidad"
          hint="Cédula o pasaporte"
          value={idDocument}
          onChange={setIdDocument}
        />
        <DocumentUploadField
          label="Carnet o título profesional"
          value={credentialDocument}
          onChange={setCredentialDocument}
        />
        <DocumentUploadField
          label="Licencia o exequátur"
          value={licenseDocument}
          onChange={setLicenseDocument}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-clay">
          {error}
        </p>
      )}

      <p className="text-xs text-ink/50">
        Al enviar esta solicitud, aceptas nuestros{" "}
        <Link href="/terminos" className="underline decoration-ink/20 underline-offset-2">
          Términos y Condiciones
        </Link>{" "}
        y nuestra{" "}
        <Link href="/privacidad" className="underline decoration-ink/20 underline-offset-2">
          Política de Privacidad
        </Link>
        .
      </p>

      <button
        type="submit"
        disabled={loading}
        className="mt-1 rounded-md bg-deep px-4 py-2.5 font-medium text-paper transition hover:bg-deepLight disabled:opacity-60"
      >
        {step === "uploading"
          ? "Subiendo documentos..."
          : step === "submitting"
            ? "Enviando solicitud..."
            : "Enviar solicitud"}
      </button>

      <p className="text-center text-xs text-ink/40">
        ¿Ya tienes cuenta? <Link href="/login" className="underline decoration-ink/20 underline-offset-2">Inicia sesión</Link>
      </p>
    </form>
  );
}
