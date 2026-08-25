import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrgAdminNav } from "@/components/OrgAdminNav";
import { hasAdminAccess } from "@/lib/roles";

export default async function OrgAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_org_admin")
    .eq("id", user!.id)
    .single();

  if (!profile || !hasAdminAccess(profile)) {
    redirect("/");
  }

  const clinicalHomeHref =
    profile.role === "therapist" ? "/therapist" : profile.role === "psychiatrist" ? "/psychiatrist" : undefined;

  return (
    <div className="flex flex-col gap-8">
      <OrgAdminNav clinicalHomeHref={clinicalHomeHref} />
      {children}
    </div>
  );
}
