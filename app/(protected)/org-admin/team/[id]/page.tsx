import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditStaffForm } from "@/components/EditStaffForm";
import { ROLE_LABELS } from "@/lib/roles";
import type { Clinic, Profile } from "@/lib/types";

export default async function EditStaffPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  if (profile?.role !== "org_admin") {
    redirect("/");
  }

  const [{ data: member }, { data: clinics }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, organization_id, clinic_id, role, full_name, email, phone, license_number, specialty, avatar_url, active, invited_by, created_at, updated_at",
      )
      .eq("id", params.id)
      .single<Profile>(),
    supabase
      .from("clinics")
      .select("id, organization_id, name, address, phone, email, timezone, logo_url, primary_color, active, created_at, updated_at")
      .order("name", { ascending: true })
      .returns<Clinic[]>(),
  ]);

  if (!member) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/org-admin" className="text-sm font-medium text-ink/50 transition hover:text-ink">
          ← Equipo
        </Link>
        <p className="mt-2 font-display text-2xl text-deep">{member.full_name}</p>
        <p className="mt-1 text-sm text-ink/50">{ROLE_LABELS[member.role] ?? member.role}</p>
      </div>

      <EditStaffForm member={member} clinics={clinics ?? []} isSelf={member.id === user!.id} />
    </div>
  );
}
