-- ============================================================================
-- Ciclo de vida de la prueba gratuita + contacto del solicitante
-- ============================================================================
-- Hasta ahora, aprobar una solicitud de registro solo dejaba un
-- organizations.trial_ends_at calculado en la edge function; no había un
-- estado explícito "en prueba" vs "con plan", así que el super_admin no tenía
-- cómo pasar una cuenta de un estado al otro, ni la app cómo distinguirlas.
--
-- Esta migración:
--   1. Agrega organizations.subscription_status ('trial' | 'active') y
--      organizations.trial_started_at.
--   2. Agrega un trigger que fija la ventana de 14 días al ENTRAR a 'trial'
--      (al crear la organización ya en prueba, o cuando el super_admin la
--      pasa de plan a prueba), sin importar desde dónde se haga el cambio.
--   3. Marca como 'trial' las organizaciones que ya nacieron de una solicitud
--      aprobada (para que el estado nuevo refleje lo que ya estaba pasando).
--   4. Agrega signup_requests.whatsapp_number; signup_requests.phone pasa a
--      ser, en la práctica, el "teléfono principal de contacto".
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Estado de suscripción
-- ----------------------------------------------------------------------------
do $$ begin
  create type public.subscription_status as enum ('trial', 'active');
exception when duplicate_object then null;
end $$;

-- Default 'active': las organizaciones dadas de alta a mano por el
-- super_admin (onboard-organization) no son pruebas gratuitas.
alter table public.organizations
  add column if not exists subscription_status public.subscription_status not null default 'active';

alter table public.organizations
  add column if not exists trial_started_at timestamptz;

comment on column public.organizations.subscription_status is
  'trial = en período de prueba gratuita (14 días desde la aprobación); active = cuenta con plan. Solo super_admin puede cambiarlo (organizations_update_super_admin).';
comment on column public.organizations.trial_started_at is
  'Momento exacto en que la organización entró a prueba (aprobación de la solicitud, o el último cambio de plan a prueba). Se conserva al pasar a plan, como historial.';

-- ----------------------------------------------------------------------------
-- 2. Trigger: ventana de 14 días al entrar a 'trial'
-- ----------------------------------------------------------------------------
-- Reglas:
--   * INSERT en 'trial': trial_started_at = ahora, trial_ends_at = +14 días
--     (salvo que quien inserta ya los haya indicado).
--   * UPDATE de 'active' a 'trial' ("viceversa"): la prueba REINICIA ahora y
--     dura 14 días completos. Si en el mismo UPDATE el super_admin indica a
--     propósito otro trial_ends_at / trial_started_at, se respeta.
--   * Cualquier otro UPDATE (incluido pasar de 'trial' a 'active', o editar
--     otros campos de una organización en prueba) no toca las fechas.
create or replace function public.apply_trial_window()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if NEW.subscription_status is distinct from 'trial' then
    return NEW;
  end if;

  if TG_OP = 'INSERT' then
    NEW.trial_started_at := coalesce(NEW.trial_started_at, now());
    NEW.trial_ends_at := coalesce(NEW.trial_ends_at, NEW.trial_started_at + interval '14 days');
    return NEW;
  end if;

  if OLD.subscription_status is distinct from 'trial' then
    if NEW.trial_started_at is not distinct from OLD.trial_started_at then
      NEW.trial_started_at := now();
    end if;
    if NEW.trial_ends_at is not distinct from OLD.trial_ends_at then
      NEW.trial_ends_at := NEW.trial_started_at + interval '14 days';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_organizations_apply_trial_window on public.organizations;
create trigger trg_organizations_apply_trial_window
  before insert or update on public.organizations
  for each row execute function public.apply_trial_window();

-- ----------------------------------------------------------------------------
-- 3. Backfill: organizaciones que ya nacieron de una solicitud aprobada
-- ----------------------------------------------------------------------------
-- Solo las enlazadas por signup_requests.created_organization_id (no todas
-- las que tengan trial_ends_at: ese campo también se puede editar a mano en
-- cualquier organización). review-signup-request ya les había puesto
-- trial_ends_at = aprobación + 14 días, así que el inicio se deduce de ahí.
update public.organizations o
set subscription_status = 'trial',
    trial_started_at = o.trial_ends_at - interval '14 days'
where o.subscription_status = 'active'
  and o.trial_started_at is null
  and o.trial_ends_at is not null
  and exists (
    select 1 from public.signup_requests sr
    where sr.created_organization_id = o.id and sr.status = 'approved'
  );

-- ----------------------------------------------------------------------------
-- 4. Contacto del solicitante
-- ----------------------------------------------------------------------------
-- Nullable a propósito: las solicitudes anteriores a este cambio no tienen
-- WhatsApp. Que sea obligatorio para las nuevas lo exige
-- submit-signup-request (única vía de inserción, con service_role); un CHECK
-- aquí, incluso NOT VALID, bloquearía los UPDATE de estado sobre filas viejas.
alter table public.signup_requests add column if not exists whatsapp_number text;

comment on column public.signup_requests.phone is
  'Teléfono principal de contacto del solicitante (obligatorio en solicitudes nuevas; submit-signup-request lo valida).';
comment on column public.signup_requests.whatsapp_number is
  'Número de WhatsApp del solicitante (obligatorio en solicitudes nuevas; submit-signup-request lo valida).';
