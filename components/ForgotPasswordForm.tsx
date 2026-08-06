"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/set-password`,
    });

    setLoading(false);

    // No revelamos si el correo existe o no en el sistema (evita filtrar
    // qué cuentas están registradas); siempre mostramos el mismo mensaje
    // de éxito salvo un error real de red/servidor.
    if (resetError && resetError.status && resetError.status >= 500) {
      setError("No se pudo enviar el correo. Intenta de nuevo en unos minutos.");
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4 text-sm text-ink/80">
        <p>
          Si <span className="font-medium text-ink">{email}</span> tiene una cuenta con nosotros,
          te enviamos un correo con un enlace para restablecer tu contraseña. Revisa también la
          carpeta de spam.
        </p>
        <Link
          href="/login"
          className="text-sm font-medium text-deep underline decoration-deep/30 underline-offset-2"
        >
          ← Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-ink/60">
        Escribe el correo con el que iniciaste sesión y te enviaremos un enlace para
        restablecer tu contraseña.
      </p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-ink/80">
          Correo electrónico
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-line bg-white px-3.5 py-2.5 text-ink outline-none transition focus:border-deep"
          placeholder="tucorreo@clinica.com"
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
        {loading ? "Enviando..." : "Enviar enlace de recuperación"}
      </button>

      <Link
        href="/login"
        className="text-center text-sm font-medium text-ink/50 transition hover:text-ink"
      >
        ← Volver a iniciar sesión
      </Link>
    </form>
  );
}
