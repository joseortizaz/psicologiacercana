import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import type { Profile } from "@/lib/types";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, clinic_id, role, full_name, email, active, is_org_admin, must_change_password")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile || !profile.active) {
    redirect("/login");
  }

  // Credenciales generadas por un administrador: cambio obligatorio antes
  // de ver cualquier otra pantalla (ver plan-independientes-y-credenciales-
  // cercana.md, sección B.3). /change-password vive fuera de este grupo de
  // rutas, así que no hay riesgo de loop -- nunca vamos a estar "ya ahí"
  // dentro de este layout.
  if (profile.must_change_password) {
    redirect("/change-password");
  }

  return (
    <AppShell fullName={profile.full_name} role={profile.role} isOrgAdmin={profile.is_org_admin}>
      {children}
    </AppShell>
  );
}
