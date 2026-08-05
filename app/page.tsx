import type { Metadata } from "next";
import { LandingClient } from "@/components/LandingClient";

export const metadata: Metadata = {
  title: "Cercana — Tu práctica, en buenas manos",
  description:
    "Cercana: la plataforma todo en uno para psicólogos y psiquiatras en República Dominicana: expedientes clínicos, agenda, firma digital de consentimientos y cumplimiento normativo.",
};

export default function LandingPage() {
  return <LandingClient />;
}
