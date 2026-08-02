import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TherapistNav } from "@/components/TherapistNav";

export default async function TherapistLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  if (profile?.role !== "therapist") {
    redirect("/");
  }

  return (
    <div className="flex flex-col gap-8">
      <TherapistNav />
      {children}
    </div>
  );
}
