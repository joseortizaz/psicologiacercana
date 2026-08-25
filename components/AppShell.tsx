import Image from "next/image";
import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Administrador",
  org_admin: "Administrador de clínica",
  therapist: "Terapeuta",
  assistant: "Asistente",
  supervisor: "Supervisor clínico",
};

// Roles que tienen panel clínico propio (agenda/pacientes/expedientes). Un
// perfil con uno de estos roles y isOrgAdmin = true (profesional
// independiente, ver plan-independientes-y-credenciales-cercana.md, sección
// A.3) necesita, además de su panel clínico normal, un acceso visible a las
// funciones administrativas de /org-admin -- "rol administrativo" y "rol
// clínico" dejan de ser mutuamente excluyentes.
const CLINICAL_PANEL_ROLES = new Set(["therapist", "psychiatrist"]);

export function AppShell({
  fullName,
  role,
  isOrgAdmin,
  children,
}: {
  fullName: string;
  role: string;
  isOrgAdmin?: boolean;
  children: React.ReactNode;
}) {
  const showAdminLink = !!isOrgAdmin && CLINICAL_PANEL_ROLES.has(role);

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <Image
              src="/brand/logo-cercana-compact.png"
              alt="Cercana"
              width={855}
              height={410}
              priority
              className="h-8 w-auto"
            />
            <p className="mt-1 text-xs text-ink/50">
              {ROLE_LABELS[role] ?? role}
              {showAdminLink && " · Profesional independiente"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {showAdminLink && (
              <Link
                href="/org-admin"
                className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:border-deep/40 hover:text-ink"
              >
                Administración
              </Link>
            )}
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
