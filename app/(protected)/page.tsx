import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  if (profile?.role === "super_admin") {
    redirect("/super-admin");
  }

  if (profile?.role === "org_admin") {
    redirect("/org-admin");
  }

  if (profile?.role === "therapist") {
    redirect("/therapist");
  }

  if (profile?.role === "assistant") {
    redirect("/assistant");
  }

  if (profile?.role === "supervisor") {
    redirect("/supervisor");
  }

  return (
    <div className="rounded-lg border border-line bg-white/60 p-8">
      <p className="font-display text-xl text-deep">Bienvenido a PsyClinic Cloud</p>
      <p className="mt-2 text-sm text-ink/60">
        El panel para tu rol todavía está en construcción. Por ahora, esta plataforma
        cuenta con paneles para Super Administrador y Administrador de Clínica.
      </p>
    </div>
  );
}
