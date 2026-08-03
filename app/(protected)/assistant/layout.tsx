import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AssistantNav } from "@/components/AssistantNav";

export default async function AssistantLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  if (profile?.role !== "assistant") {
    redirect("/");
  }

  return (
    <div className="flex flex-col gap-8">
      <AssistantNav />
      {children}
    </div>
  );
}
