"use client";

import { useState } from "react";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_DISPLAY } from "@/lib/support";

// Cuando la cuenta está en solo lectura, impide enviar cualquier formulario de
// la pantalla (alta/edición) y avisa. Es una capa de cortesía: el bloqueo real
// lo hacen los triggers de la base de datos, que rechazan cualquier escritura
// aunque se llegue a ella por otro camino.
//
// Un formulario que SÍ debe seguir funcionando estando bloqueado (cambio de
// contraseña, WhatsApp del perfil) se marca con data-allow-when-locked.
export function ReadOnlyBoundary({ locked, children }: { locked: boolean; children: React.ReactNode }) {
  const [notice, setNotice] = useState(false);

  if (!locked) return <>{children}</>;

  return (
    <div
      onSubmitCapture={(e) => {
        const form = e.target as HTMLElement;
        if (form instanceof HTMLFormElement && form.hasAttribute("data-allow-when-locked")) return;
        e.preventDefault();
        e.stopPropagation();
        setNotice(true);
      }}
    >
      {notice && (
        <p role="alert" className="mb-4 rounded-md border border-clay bg-clay/10 px-3 py-2 text-sm text-clay">
          Tu cuenta está en modo solo lectura: no se pueden guardar cambios. Contáctanos para reactivarla: {SUPPORT_EMAIL} o WhatsApp {SUPPORT_WHATSAPP_DISPLAY}.
        </p>
      )}
      {children}
    </div>
  );
}
