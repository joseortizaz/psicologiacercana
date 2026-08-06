import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignupRequestsManager } from "@/components/SignupRequestsManager";
import type { SignupRequest } from "@/lib/types";

export default async function SignupRequestsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  if (profile?.role !== "super_admin") {
    redirect("/");
  }

  const { data: requests } = await supabase
    .from("signup_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<SignupRequest[]>();

  const pendingCount = requests?.filter((r) => r.status === "pending").length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/super-admin"
          className="text-sm font-medium text-ink/50 transition hover:text-ink"
        >
          ← Clínicas
        </Link>
        <p className="mt-2 font-display text-2xl text-deep">Solicitudes de registro</p>
        <p className="mt-1 text-sm text-ink/50">
          {pendingCount} solicitud(es) pendiente(s) de {requests?.length ?? 0} en total
        </p>
      </div>

      <SignupRequestsManager initialRequests={requests ?? []} />
    </div>
  );
}
