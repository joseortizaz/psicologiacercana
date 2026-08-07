import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-10 text-center">
          <Link href="/">
            <Image
              src="/brand/logo-cercana-full.png"
              alt="Cercana"
              width={855}
              height={410}
              priority
              className="mx-auto h-10 w-auto"
            />
          </Link>
        </div>

        <div className="rounded-lg border border-line bg-white/60 p-6 shadow-sm sm:p-10">
          <p className="text-xs font-medium uppercase tracking-wide text-ink/40">
            Narnia Tech Solution, SRL — RNC 1-33-74485-6
          </p>
          <h1 className="mt-2 font-display text-2xl text-deep sm:text-3xl">{title}</h1>
          <p className="mt-1.5 text-sm text-ink/50">Última actualización: {updatedAt}</p>

          <div className="legal-content mt-2">{children}</div>
        </div>

        <p className="mt-8 text-center text-xs text-ink/40">
          <Link href="/" className="underline decoration-ink/20 underline-offset-2">
            ← Volver al inicio
          </Link>
        </p>
      </div>
    </main>
  );
}
