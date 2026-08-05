import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UpdateProfileForm } from "@/components/UpdateProfileForm";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { ROLE_LABELS } from "@/lib/roles";
import type { Profile } from "@/lib/types";

export default async function AccountPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, organization_id, clinic_id, role, full_name, email, phone, license_number, specialty, avatar_url, active, invited_by, created_at, updated_at",
    )
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) {
    redirect("/login");
  }

  return (
    <div className="flex max-w-lg flex-col gap-10">
      <div>
        <p className="font-display text-2xl text-deep">Ajustes de cuenta</p>
        <p className="mt-1 text-sm text-ink/50">
          {profile.email} · {ROLE_LABELS[profile.role] ?? profile.role}
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <p className="font-display text-lg text-deep">Datos personales</p>
        <UpdateProfileForm
          role={profile.role}
          initialFullName={profile.full_name}
          initialPhone={profile.phone}
          initialLicenseNumber={profile.license_number}
          initialSpecialty={profile.specialty}
        />
      </section>

      <section className="flex flex-col gap-4 border-t border-line pt-8">
        <p className="font-display text-lg text-deep">Contraseña</p>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
