"use client";

import Image from "next/image";

// Boundary de error para todo el grupo app/(protected). Captura, entre
// otras cosas, los throw de layout.tsx cuando no se pudo verificar la
// sesión o el perfil por un problema transitorio (red, Supabase lento)
// -- en vez de que la persona vea un redirect confuso a /login, ve un
// mensaje claro con la opción de reintentar sin perder su sesión.
export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <Image
          src="/brand/logo-cercana-full.png"
          alt="Cercana"
          width={855}
          height={410}
          priority
          className="mx-auto mb-8 h-12 w-auto"
        />

        <div className="rounded-lg border border-line bg-white/60 p-6 shadow-sm">
          <p className="text-sm text-ink/80">
            No pudimos verificar tu sesión. Esto suele ser temporal (una
            respuesta lenta del servidor) y no significa que se haya cerrado
            tu sesión.
          </p>
          <p className="mt-2 text-xs text-ink/50">{error.message}</p>

          <button
            type="button"
            onClick={reset}
            className="mt-6 w-full rounded-md bg-deep px-4 py-2.5 font-medium text-paper transition hover:bg-deepLight"
          >
            Reintentar
          </button>
        </div>
      </div>
    </main>
  );
}
