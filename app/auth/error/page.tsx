export default function AuthErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <p className="font-display text-xl text-deep">El enlace no es válido</p>
        <p className="mt-2 text-sm text-ink/60">
          Puede que ya haya sido usado o que haya expirado. Pídele a quien te invitó que te
          reenvíe la invitación.
        </p>
        <a
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-deep underline decoration-deep/30 underline-offset-2"
        >
          Ir al login
        </a>
      </div>
    </main>
  );
}
