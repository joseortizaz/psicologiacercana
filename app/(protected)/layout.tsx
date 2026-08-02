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
    .select("id, organization_id, clinic_id, role, full_name, email, active")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile || !profile.active) {
    redirect("/login");
  }

  return (
    <AppShell fullName={profile.full_name} role={profile.role}>
      {children}
    </AppShell>
  );
}
