"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/org-admin", label: "Inicio" },
  { href: "/org-admin/patients", label: "Pacientes" },
  { href: "/org-admin/appointments", label: "Citas" },
  { href: "/org-admin/audit", label: "Auditoría" },
];

export function OrgAdminNav({ clinicalHomeHref }: { clinicalHomeHref?: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center justify-between gap-6 border-b border-line pb-3">
      <div className="flex gap-6">
        {LINKS.map((link) => {
          const active =
            link.href === "/org-admin" ? pathname === link.href : pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition ${
                active ? "text-deep" : "text-ink/50 hover:text-ink"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
      {clinicalHomeHref && (
        <Link
          href={clinicalHomeHref}
          className="text-sm font-medium text-ink/50 underline decoration-ink/20 underline-offset-2 transition hover:text-ink"
        >
          ← Volver a mi panel clínico
        </Link>
      )}
    </nav>
  );
}
