import type { Metadata } from "next";
import "./globals.css";
import { ConditionalAnalytics } from "@/components/ConditionalAnalytics";

const SITE_URL = "https://www.cercanard.com";
const SITE_TITLE = "Cercana — Tu práctica, en buenas manos";
const SITE_DESCRIPTION =
  "Plataforma de gestión clínica para psicólogos y psiquiatras en República Dominicana: expedientes, agenda y consentimientos.";

// metadataBase hace absolutas las URL de la vista previa: WhatsApp, Facebook y
// otras redes solo aceptan og:image con dirección completa. La imagen sale de
// app/opengraph-image.jpg (1200×630, menos de 300 KB, que es lo que WhatsApp
// admite para mostrar la miniatura).
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Cercana",
  description: "Gestión clínica y administrativa para consultorios de psicología",
  openGraph: {
    type: "website",
    siteName: "Cercana",
    locale: "es_DO",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
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
