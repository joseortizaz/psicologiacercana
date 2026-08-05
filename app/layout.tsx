import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cercana",
  description: "Gestión clínica y administrativa para consultorios de psicología",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
