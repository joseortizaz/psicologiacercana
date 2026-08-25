import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ForcedPasswordChangeForm } from "@/components/ForcedPasswordChangeForm";

export default async function ChangePasswordPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Image
            src="/brand/logo-cercana-full.png"
            alt="Cercana"
            width={855}
            height={410}
            priority
            className="mx-auto h-12 w-auto"
          />
          <p className="mt-1.5 text-sm text-ink/60">Cambio de contraseña obligatorio</p>
        </div>

        <div className="rounded-lg border border-line bg-white/60 p-6 shadow-sm">
          <ForcedPasswordChangeForm />
        </div>
      </div>
    </main>
  );
}
