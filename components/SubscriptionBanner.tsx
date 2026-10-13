import type { AccessState } from "@/lib/types";
import { formatDate } from "@/lib/subscription";

// Aviso en el panel del profesional según my_org_access_state(). A propósito
// NO dice cuántos días faltan para perder la edición: solo que la fecha ya
// venció y que pronto se perderá (ver reglas en la migración).
export function SubscriptionBanner({ access, supportEmail }: { access: AccessState; supportEmail: string }) {
  if (access.state === "ok") return null;

  const due = access.due_at ? formatDate(access.due_at) : null;
  const contact = (
    <>
      Escríbenos a{" "}
      <a href={`mailto:${supportEmail}`} className="font-medium underline">
        {supportEmail}
      </a>
      .
    </>
  );

  let tone = "border-clay/40 bg-clay/10 text-ink";
  let title = "";
  let body: React.ReactNode = null;

  if (access.state === "locked") {
    tone = "border-clay bg-clay/15 text-ink";
    if (access.reason === "suspended") {
      title = "Tu cuenta está en modo solo lectura";
      body = <>Tu cuenta está suspendida. Puedes consultar la información ya registrada, pero no agregar ni modificar datos. {contact}</>;
    } else if (access.reason === "trial_expired") {
      title = "Tu prueba gratuita terminó";
      body = <>Tu cuenta está en modo solo lectura: puedes consultar lo ya registrado, pero no agregar ni modificar datos. Al activar un plan podrás volver a editar. {contact}</>;
    } else {
      title = "Tu cuenta está en modo solo lectura";
      body = <>No recibimos el pago de tu plan. Puedes consultar lo ya registrado, pero no agregar ni modificar datos. Al registrar tu pago podrás volver a editar. {contact}</>;
    }
  } else if (access.state === "warning") {
    title = "Tu pago está vencido";
    body = <>Tu plan venció{due ? ` el ${due}` : ""}. Renuévalo pronto: de lo contrario perderás pronto la posibilidad de editar tus datos. {contact}</>;
  } else if (access.reason === "trial_ending") {
    title = "Tu prueba gratuita está por terminar";
    body = <>Termina {due ? `el ${due}` : "pronto"}. Al terminar, la cuenta pasa a solo lectura hasta que actives un plan. {contact}</>;
  } else {
    title = "Se acerca la fecha de renovación de tu plan";
    body = <>Tu próxima fecha de pago es {due ?? "pronto"}. Renueva a tiempo para no interrumpir tu trabajo. {contact}</>;
  }

  return (
    <div role="status" className={`mb-6 rounded-lg border px-4 py-3 text-sm ${tone}`}>
      <p className="font-medium text-deep">{title}</p>
      <p className="mt-0.5 text-ink/80">{body}</p>
    </div>
  );
}
