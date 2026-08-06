import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrganizationsTable } from "@/components/OrganizationsTable";
import { OnboardOrganizationForm } from "@/components/OnboardOrganizationForm";
import type { Organization } from "@/lib/types";

export default async function SuperAdminPage() {
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

  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, name, plan_id, plan:plans(id, name, code), status, billing_email, created_at")
    .order("created_at", { ascending: false })
    .returns<Organization[]>();

  const { count: pendingSignupCount } = await supabase
    .from("signup_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-2xl text-deep">Clínicas registradas</p>
          <p className="mt-1 text-sm text-ink/50">
            {organizations?.length ?? 0} clínica(s) en la plataforma
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/super-admin/signup-requests"
            className="flex items-center gap-1.5 text-sm font-medium text-deep underline decoration-deep/30 underline-offset-2"
          >
            Solicitudes de registro
            {!!pendingSignupCount && (
              <span className="rounded-full bg-clay/15 px-2 py-0.5 text-xs font-semibold text-clay no-underline">
                {pendingSignupCount}
              </span>
            )}
          </Link>
          <Link
            href="/super-admin/plans"
            className="text-sm font-medium text-deep underline decoration-deep/30 underline-offset-2"
          >
            Gestionar planes
          </Link>
          <Link
            href="/super-admin/audit"
            className="text-sm font-medium text-deep underline decoration-deep/30 underline-offset-2"
          >
            Ver auditoría
          </Link>
          <OnboardOrganizationForm />
        </div>
      </div>

      <OrganizationsTable initialOrganizations={organizations ?? []} />
    </div>
  );
}
