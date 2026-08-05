import Image from "next/image";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Image
            src="/brand/logo-cercana-full.png"
            alt="Cercana"
            width={855}
            height={410}
            priority
            className="mx-auto h-12 w-auto"
          />
          <p className="mt-1.5 text-sm text-ink/60">Ingresa a tu cuenta</p>
        </div>

        <div className="rounded-lg border border-line bg-white/60 p-6 shadow-sm">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-ink/40">
          ¿No tienes cuenta? Contacta al administrador de tu clínica para que te invite.
        </p>
      </div>
    </main>
  );
}
