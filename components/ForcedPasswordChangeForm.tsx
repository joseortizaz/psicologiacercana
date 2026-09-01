"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PasswordInput } from "@/components/PasswordInput";

// Formulario de /change-password -- ver
// plan-independientes-y-credenciales-cercana.md, sección B.3. A diferencia
// de ChangePasswordForm (cambio voluntario desde /account) y SetPasswordForm
// (primera contraseña tras el flujo de invitación por correo), este
// formulario es OBLIGATORIO: se llega aquí porque
// app/(protected)/layout.tsx detectó must_change_password = true y
// redirigió antes de renderizar cualquier otra pantalla. Tras actualizar la
// contraseña, limpia esa bandera con mark_password_changed() -- si no se
// limpia, el próximo layout.tsx vuelve a mandar aquí en un ciclo -- y recién
// entonces redirige a "/dashboard".
export function ForcedPasswordChangeForm() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setLoading(false);
      setError(updateError.message);
      return;
    }

    const { error: markError } = await supabase.rpc("mark_password_changed");

    setLoading(false);

    if (markError) {
      // La contraseña sí cambió; solo no se pudo limpiar la bandera. No
      // dejamos a la persona atascada por esto -- lo reportamos, pero
      // igual permitimos continuar.
      setError(
        "Tu contraseña se actualizó, pero hubo un problema al confirmarlo. Si vuelves a ver esta pantalla, contacta a soporte.",
      );
    }

    // El middleware ya no corre sobre "/" (ver fix de dependencia
    // innecesaria de Supabase en rutas públicas), así que navegamos al
    // panel explícitamente en vez de depender de su redirect.
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-ink/70">
        Por seguridad, debes elegir tu propia contraseña antes de continuar.
      </p>

      <PasswordInput
        id="password"
        label="Nueva contraseña"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
      />

      <PasswordInput
        id="confirmPassword"
        label="Confirmar contraseña"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={setConfirmPassword}
      />

      {error && (
        <p role="alert" className="text-sm text-clay">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-1 rounded-md bg-deep px-4 py-2.5 font-medium text-paper transition hover:bg-deepLight disabled:opacity-60"
      >
        {loading ? "Guardando..." : "Guardar contraseña y continuar"}
      </button>
    </form>
  );
}
