"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SetPasswordForm() {
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

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-ink/80">
          Nueva contraseña
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-line bg-white px-3.5 py-2.5 text-ink outline-none transition focus:border-deep"
          placeholder="••••••••"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirmPassword" className="text-sm font-medium text-ink/80">
          Confirmar contraseña
        </label>
        <input
          id="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="rounded-md border border-line bg-white px-3.5 py-2.5 text-ink outline-none transition focus:border-deep"
          placeholder="••••••••"
        />
      </div>

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
        {loading ? "Guardando..." : "Guardar contraseña"}
      </button>
    </form>
  );
}
