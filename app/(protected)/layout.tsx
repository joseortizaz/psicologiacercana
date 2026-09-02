import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import type { Profile } from "@/lib/types";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    // No pudimos verificar la sesión contra el servidor de Auth de
    // Supabase (por ejemplo, su API está lenta o con errores
    // intermitentes -- ver incidente de Degraded Performance en
    // status.supabase.com). El middleware ya distingue este caso, pero
    // esta llamada es independiente y corría el mismo riesgo: un fallo
    // transitorio no significa "no hay sesión", así que en vez de
    // expulsar a /login (lo que se ve como si la sesión se hubiera
    // perdido) mostramos un error explícito -- ver
    // app/(protected)/error.tsx -- para que la persona pueda
    // reintentar con un solo clic.
    throw new Error("No se pudo verificar tu sesión. Intenta de nuevo en unos segundos.");
  }

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, organization_id, clinic_id, role, full_name, email, active, is_org_admin, must_change_password")
    .eq("id", user.id)
    .single<Profile>();

  if (profileError && profileError.code !== "PGRST116") {
    // Mismo criterio: error real (red, timeout) distinto de "no existe
    // perfil para este usuario" (PGRST116, lo que sí es un caso válido
    // para mandar a /login más abajo).
    throw new Error("No se pudo cargar tu perfil. Intenta de nuevo en unos segundos.");
  }

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
