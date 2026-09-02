"use client";

import Image from "next/image";

// Tarjeta de "no se pudo verificar" para app/(protected)/layout.tsx.
//
// Por qué esto vive aquí y no en app/(protected)/error.tsx: los error
// boundaries de Next.js (error.tsx) NO capturan errores lanzados por el
// layout.tsx del MISMO segmento -- solo capturan errores de lo que ese
// layout renderiza hacia abajo (páginas y layouts anidados). Como
// layout.tsx necesita mostrar esta tarjeta quando su propia verificación
// de sesión/perfil falla, la única forma confiable es que el layout
// renderice esta UI directamente (sin throw), en vez de depender de un
// error boundary que nunca llega a interceptar el fallo. (error.tsx sigue
// siendo útil para errores reales dentro de las páginas del panel, por
// ejemplo en AppShell o en page.tsx -- eso sí queda debajo del layout.)
export function SessionRetryCard({ message }: { message: string }) {
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
          <p className="mt-2 text-xs text-ink/50">{message}</p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 w-full rounded-md bg-deep px-4 py-2.5 font-medium text-paper transition hover:bg-deepLight"
          >
            Reintentar
          </button>
        </div>
      </div>
    </main>
  );
}
