import Image from "next/image";
import Link from "next/link";
import { SignupRequestForm } from "@/components/SignupRequestForm";

export default function RegistroPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <Link href="/">
            <Image
              src="/brand/logo-cercana-full.png"
              alt="Cercana"
              width={855}
              height={410}
              priority
              className="mx-auto h-12 w-auto"
            />
          </Link>
          <p className="mt-1.5 text-sm text-ink/60">
            Prueba gratuita de 14 días — regístrate como terapeuta
          </p>
        </div>

        <div className="rounded-lg border border-line bg-white/60 p-6 shadow-sm sm:p-8">
          <SignupRequestForm />
        </div>

        <p className="mt-6 text-center text-xs text-ink/40">
          Tu solicitud será revisada por nuestro equipo antes de activar tu cuenta. Tus datos y
          documentos están protegidos.
        </p>
      </div>
    </main>
  );
}
