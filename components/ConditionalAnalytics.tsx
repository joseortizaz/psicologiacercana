"use client";

import { usePathname } from "next/navigation";
import { GoogleAnalytics } from "@next/third-parties/google";

const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/registro",
  "/forgot-password",
  "/preguntas-frecuentes",
  "/privacidad",
  "/terminos",
];

export function ConditionalAnalytics({ gaId }: { gaId: string }) {
  const pathname = usePathname();
  const isPublicPage =
    pathname === "/" || PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!isPublicPage) return null;

  return <GoogleAnalytics gaId={gaId} />;
}
