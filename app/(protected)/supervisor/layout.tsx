import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupervisorNav } from "@/components/SupervisorNav";

export default async function SupervisorLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  if (profile?.role !== "supervisor") {
    redirect("/");
  }

  return (
    <div className="flex flex-col gap-8">
      <SupervisorNav />
      {children}
    </div>
  );
}
