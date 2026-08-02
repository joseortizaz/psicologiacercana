"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "Correo o contraseña incorrectos."
          : signInError.message,
      );
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-ink/80">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
        {loading ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
