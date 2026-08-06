import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlansManager } from "@/components/PlansManager";
import type { Plan } from "@/lib/types";

export default async function PlansPage() {
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

  const { data: plans } = await supabase
    .from("plans")
    .select("*")
    .order("display_order", { ascending: true })
    .returns<Plan[]>();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/super-admin"
          className="text-sm font-medium text-ink/50 transition hover:text-ink"
        >
          ← Clínicas
        </Link>
        <p className="mt-2 font-display text-2xl text-deep">Planes de suscripción</p>
        <p className="mt-1 text-sm text-ink/50">
          {plans?.length ?? 0} plan(es) configurados
        </p>
      </div>

      <PlansManager initialPlans={plans ?? []} />
    </div>
  );
}
