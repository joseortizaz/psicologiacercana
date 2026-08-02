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
    .select("id, name, plan, status, billing_email, created_at")
    .order("created_at", { ascending: false })
    .returns<Organization[]>();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-2xl text-deep">Clínicas registradas</p>
          <p className="mt-1 text-sm text-ink/50">
            {organizations?.length ?? 0} clínica(s) en la plataforma
          </p>
        </div>
        <OnboardOrganizationForm />
      </div>

      <OrganizationsTable initialOrganizations={organizations ?? []} />
    </div>
  );
}
