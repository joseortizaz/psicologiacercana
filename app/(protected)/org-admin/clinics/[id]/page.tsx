import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditClinicForm } from "@/components/EditClinicForm";
import { hasAdminAccess } from "@/lib/roles";
import type { Clinic } from "@/lib/types";

export default async function EditClinicPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_org_admin")
    .eq("id", user!.id)
    .single();

  if (!profile || !hasAdminAccess(profile)) {
    redirect("/");
  }

  const { data: clinic } = await supabase
    .from("clinics")
    .select(
      "id, organization_id, name, address, phone, email, timezone, logo_url, primary_color, active, created_at, updated_at",
    )
    .eq("id", params.id)
    .single<Clinic>();

  if (!clinic) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/org-admin" className="text-sm font-medium text-ink/50 transition hover:text-ink">
          ← Sucursales
        </Link>
        <p className="mt-2 font-display text-2xl text-deep">{clinic.name}</p>
        <p className="mt-1 text-sm text-ink/50">
          Creada el {new Date(clinic.created_at).toLocaleDateString("es-DO")}
        </p>
      </div>

      <EditClinicForm clinic={clinic} />
    </div>
  );
}
