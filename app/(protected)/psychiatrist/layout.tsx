import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PsychiatristNav } from "@/components/PsychiatristNav";

export default async function PsychiatristLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  if (profile?.role !== "psychiatrist") {
    redirect("/");
  }

  return (
    <div className="flex flex-col gap-8">
      <PsychiatristNav />
      {children}
    </div>
  );
}
