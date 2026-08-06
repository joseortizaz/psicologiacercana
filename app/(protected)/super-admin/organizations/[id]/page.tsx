import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditOrganizationForm } from "@/components/EditOrganizationForm";
import type { Organization } from "@/lib/types";

export default async function EditOrganizationPage({ params }: { params: { id: string } }) {
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

  const { data: organization } = await supabase
    .from("organizations")
    .select(
      "id, name, legal_name, tax_id, plan_id, status, billing_email, country, timezone, trial_ends_at, max_clinics, created_at, updated_at",
    )
    .eq("id", params.id)
    .single<Organization>();

  if (!organization) {
    notFound();
  }

  const { data: plans } = await supabase
    .from("plans")
    .select("id, name, tagline, max_therapists, max_org_admins, max_assistants, max_supervisors")
    .eq("active", true)
    .order("display_order", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/super-admin"
          className="text-sm font-medium text-ink/50 transition hover:text-ink"
        >
          ← Clínicas
        </Link>
        <p className="mt-2 font-display text-2xl text-deep">{organization.name}</p>
        <p className="mt-1 text-sm text-ink/50">
          Registrada el {new Date(organization.created_at).toLocaleDateString("es-DO")}
        </p>
      </div>

      <EditOrganizationForm organization={organization} plans={plans ?? []} />
    </div>
  );
}
