"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/therapist", label: "Inicio" },
  { href: "/therapist/patients", label: "Pacientes" },
  { href: "/therapist/appointments", label: "Citas" },
];

export function TherapistNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-6 border-b border-line pb-3">
      {LINKS.map((link) => {
        const active =
          link.href === "/therapist" ? pathname === link.href : pathname.startsWith(link.href);

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
    </nav>
  );
}
