import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditOrganizationForm } from "@/components/EditOrganizationForm";
import { SubscriptionPanel, type OrgContact } from "@/components/SubscriptionPanel";
import type { Organization, SubscriptionPayment } from "@/lib/types";

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
      "id, name, legal_name, tax_id, plan_id, status, subscription_status, billing_email, country, timezone, trial_started_at, trial_ends_at, billing_cycle, paid_until, max_clinics, created_at, updated_at",
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

  const { data: payments } = await supabase
    .from("subscription_payments")
    .select("id, organization_id, plan_id, billing_cycle, amount, currency, paid_at, covers_until, note, created_at")
    .eq("organization_id", organization.id)
    .order("paid_at", { ascending: false })
    .returns<SubscriptionPayment[]>();

  // Quién contactar: administradores de la organización y, en cuentas de un
  // solo profesional, el propio terapeuta (WhatsApp guardado en su perfil).
  const { data: contacts } = await supabase
    .from("profiles")
    .select("full_name, email, phone, whatsapp_number")
    .eq("organization_id", organization.id)
    .eq("active", true)
    .or("role.eq.org_admin,is_org_admin.eq.true,role.eq.therapist,role.eq.psychiatrist")
    .order("created_at", { ascending: true })
    .limit(5)
    .returns<OrgContact[]>();

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

      <SubscriptionPanel
        organization={organization}
        plans={(plans ?? []).map((p) => ({ id: p.id, name: p.name }))}
        payments={payments ?? []}
        contacts={contacts ?? []}
      />

      <EditOrganizationForm organization={organization} plans={plans ?? []} />
    </div>
  );
}
