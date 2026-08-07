import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function PsychiatristHomePage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { count: activeCount } = await supabase
    .from("clinical_record_team_members")
    .select("id", { count: "exact", head: true })
    .eq("clinician_id", user!.id)
    .eq("active", true);

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-line bg-white/60 p-6">
          <p className="text-xs uppercase tracking-wide text-ink/40">
            Expedientes en tu equipo de atención
          </p>
          <p className="mt-2 font-display text-3xl text-deep">{activeCount ?? 0}</p>
          <Link
            href="/psychiatrist/patients"
            className="mt-3 inline-block text-sm font-medium text-deep underline decoration-deep/30 underline-offset-2"
          >
            Ver pacientes
          </Link>
        </div>
      </section>
    </div>
  );
}
