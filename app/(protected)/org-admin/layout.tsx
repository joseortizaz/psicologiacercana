import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrgAdminNav } from "@/components/OrgAdminNav";

export default async function OrgAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  if (profile?.role !== "org_admin") {
    redirect("/");
  }

  return (
    <div className="flex flex-col gap-8">
      <OrgAdminNav />
      {children}
    </div>
  );
}
