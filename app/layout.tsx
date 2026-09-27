import type { Metadata } from "next";
import "./globals.css";
import { ConditionalAnalytics } from "@/components/ConditionalAnalytics";

export const metadata: Metadata = {
  title: "Cercana",
  description: "Gestión clínica y administrativa para consultorios de psicología",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {children}
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <ConditionalAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
        )}
      </body>
    </html>
  );
}
