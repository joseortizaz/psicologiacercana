"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PasswordInput } from "@/components/PasswordInput";

export function ChangePasswordForm() {
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

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

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setSuccess(true);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <PasswordInput
        id="newPassword"
        label="Nueva contraseña"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
      />

      <PasswordInput
        id="confirmNewPassword"
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
      {success && <p className="text-sm text-sage">Contraseña actualizada.</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-1 self-start rounded-md bg-deep px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-deepLight disabled:opacity-60"
      >
        {loading ? "Guardando..." : "Cambiar contraseña"}
      </button>
    </form>
  );
}
