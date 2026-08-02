import { SetPasswordForm } from "@/components/SetPasswordForm";

export default function SetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-2xl font-medium text-deep">PsyClinic Cloud</p>
          <p className="mt-1.5 text-sm text-ink/60">Elige una contraseña para tu cuenta</p>
        </div>

        <div className="rounded-lg border border-line bg-white/60 p-6 shadow-sm">
          <SetPasswordForm />
        </div>
      </div>
    </main>
  );
}
