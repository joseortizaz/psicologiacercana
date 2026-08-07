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

  if (profile?.role === "psychiatrist") {
    redirect("/psychiatrist");
  }

  return (
    <div className="rounded-lg border border-line bg-white/60 p-8">
      <p className="font-display text-xl text-deep">Bienvenido a Cercana</p>
      <p className="mt-2 text-sm text-ink/60">
        No pudimos determinar tu rol en la plataforma. Si crees que esto es un error,
        contacta al administrador de tu organización.
      </p>
    </div>
  );
}
