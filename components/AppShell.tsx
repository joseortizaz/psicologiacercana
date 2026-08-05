import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Administrador",
  org_admin: "Administrador de clínica",
  therapist: "Terapeuta",
  assistant: "Asistente",
  supervisor: "Supervisor clínico",
};

export function AppShell({
  fullName,
  role,
  children,
}: {
  fullName: string;
  role: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="font-display text-lg font-medium text-deep">PsyClinic Cloud</p>
            <p className="text-xs text-ink/50">{ROLE_LABELS[role] ?? role}</p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/account"
              className="text-sm text-ink/70 underline decoration-ink/20 underline-offset-2 transition hover:text-ink"
            >
              {fullName}
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
