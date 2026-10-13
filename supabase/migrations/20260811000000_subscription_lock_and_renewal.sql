-- ============================================================================
-- Vencimiento de la suscripción: avisos y modo de solo lectura
-- ============================================================================
-- Reglas de negocio:
--   * Prueba: al llegar trial_ends_at la cuenta pasa a SOLO LECTURA. Aviso en
--     los últimos 3 días.
--   * Plan mensual: aviso desde 7 días antes de paid_until. Vencida la fecha,
--     advertencia de que pronto se perderá la edición (sin decir cuántos
--     días). A los 10 días de paid_until sin pago, SOLO LECTURA.
--   * Plan anual: aviso desde 30 días antes de paid_until. A los 20 días de
--     vencido sin pago, SOLO LECTURA.
--   * organizations.status = 'suspended' | 'cancelled' también es solo
--     lectura (suspensión manual del super_admin).
--   * Solo lectura = el usuario sigue viendo lo ya registrado, pero no puede
--     insertar, modificar ni borrar nada de su organización. Vuelve a la
--     normalidad en cuanto el super_admin registra un pago o reactiva la
--     cuenta.
--   * Los pagos los registra a mano el super_admin (register_subscription_payment).
--   * Una cuenta con plan y sin paid_until (las que existían antes de esta
--     migración) NUNCA se bloquea por fecha: el super_admin debe registrar su
--     primer pago para que empiece a regir el calendario.
--
-- Dónde se aplica: en la base de datos (triggers BEFORE sobre las tablas del
-- tenant), no solo en la interfaz, porque el cliente de Supabase habla directo
-- con la base. Los triggers no aplican a service_role (auth.uid() es null:
-- edge functions, migraciones) ni al super_admin.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Columnas
-- ----------------------------------------------------------------------------
alter table public.organizations
  add column if not exists billing_cycle text not null default 'monthly',
  add column if not exists paid_until timestamptz;

do $$ begin
  alter table public.organizations
    add constraint organizations_billing_cycle_check check (billing_cycle in ('monthly', 'annual'));
exception when duplicate_object then null; end $$;

comment on column public.organizations.billing_cycle is
  'monthly | annual. Define los plazos de aviso y de gracia antes del solo lectura.';
comment on column public.organizations.paid_until is
  'Fecha hasta la que está pagado el período vigente (la siguiente fecha de pago). La mueve register_subscription_payment. Null = nunca bloquear por fecha.';

alter table public.profiles add column if not exists whatsapp_number text;
comment on column public.profiles.whatsapp_number is
  'WhatsApp del usuario, para que el super_admin pueda contactarlo (renovaciones, avisos). Se conserva siempre en el perfil.';

-- Los profesionales ya aprobados conservan el WhatsApp que dieron al registrarse.
update public.profiles p
set whatsapp_number = sr.whatsapp_number
from public.signup_requests sr
where p.whatsapp_number is null
  and sr.whatsapp_number is not null
  and sr.status = 'approved'
  and lower(sr.email) = lower(p.email);

-- ----------------------------------------------------------------------------
-- 2. Registro de pagos (manual, por el super_admin)
-- ----------------------------------------------------------------------------
create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  plan_id uuid references public.plans(id),
  billing_cycle text not null check (billing_cycle in ('monthly', 'annual')),
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'DOP',
  paid_at timestamptz not null default now(),
  covers_until timestamptz not null,
  note text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists subscription_payments_org_idx
  on public.subscription_payments (organization_id, paid_at desc);

alter table public.subscription_payments enable row level security;

drop policy if exists subscription_payments_select on public.subscription_payments;
create policy subscription_payments_select on public.subscription_payments
  for select using (
    public.is_super_admin()
    or (organization_id = public.auth_organization_id() and public.auth_role() = 'org_admin'::user_role)
  );
-- Sin policies de INSERT/UPDATE/DELETE: solo se escribe vía register_subscription_payment.

-- ----------------------------------------------------------------------------
-- 3. Cálculo del estado de acceso
-- ----------------------------------------------------------------------------
-- Momento en que la organización pasa a solo lectura (null = no hay fecha).
-- Para status suspended/cancelled devuelve now() - 1s (ya bloqueada).
create or replace function public.org_lock_at(p_org uuid)
returns timestamptz
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  o public.organizations;
begin
  select * into o from public.organizations where id = p_org;
  if not found then return null; end if;

  if o.status::text <> 'active' then
    return now() - interval '1 second';
  end if;

  if o.subscription_status = 'trial' then
    return o.trial_ends_at;
  end if;

  if o.paid_until is null then return null; end if;
  return o.paid_until + case when o.billing_cycle = 'annual' then interval '20 days' else interval '10 days' end;
end;
$$;

create or replace function public.org_is_locked(p_org uuid)
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(public.org_lock_at(p_org) <= now(), false);
$$;

-- Estado que ve el panel del profesional. No expone cuántos días de gracia
-- quedan: solo 'ok' | 'notice' | 'warning' | 'locked' y la fecha de vencimiento.
--   notice  = se acerca el vencimiento (prueba o renovación)
--   warning = ya venció la fecha de pago; pronto perderá la edición
--   locked  = solo lectura
create or replace function public.org_access_state(p_org uuid)
returns table (
  state text,
  reason text,
  due_at timestamptz,
  days_until_due integer,
  subscription_status text,
  billing_cycle text
)
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  o public.organizations;
  v_state text := 'ok';
  v_reason text := null;
  v_due timestamptz := null;
  v_notice interval;
begin
  select * into o from public.organizations where id = p_org;
  if not found then return; end if;

  v_notice := case when o.billing_cycle = 'annual' then interval '30 days' else interval '7 days' end;

  if o.status::text <> 'active' then
    v_state := 'locked'; v_reason := 'suspended';
  elsif o.subscription_status = 'trial' then
    v_due := o.trial_ends_at;
    if v_due is not null then
      if v_due <= now() then
        v_state := 'locked'; v_reason := 'trial_expired';
      elsif v_due <= now() + interval '3 days' then
        v_state := 'notice'; v_reason := 'trial_ending';
      end if;
    end if;
  elsif o.paid_until is not null then
    v_due := o.paid_until;
    if public.org_is_locked(p_org) then
      v_state := 'locked'; v_reason := 'payment_overdue';
    elsif v_due <= now() then
      v_state := 'warning'; v_reason := 'payment_overdue';
    elsif v_due <= now() + v_notice then
      v_state := 'notice'; v_reason := 'renewal_upcoming';
    end if;
  end if;

  return query select
    v_state, v_reason, v_due,
    case when v_due is null then null else ceil(extract(epoch from (v_due - now())) / 86400)::integer end,
    o.subscription_status::text, o.billing_cycle;
end;
$$;

-- Estado de la organización de quien llama.
create or replace function public.my_org_access_state()
returns table (
  state text,
  reason text,
  due_at timestamptz,
  days_until_due integer,
  subscription_status text,
  billing_cycle text
)
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select * from public.org_access_state(public.auth_organization_id());
$$;

revoke all on function public.org_lock_at(uuid) from public, anon, authenticated;
revoke all on function public.org_access_state(uuid) from public, anon, authenticated;
grant execute on function public.org_is_locked(uuid) to authenticated;
grant execute on function public.my_org_access_state() to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Triggers de solo lectura
-- ----------------------------------------------------------------------------
create or replace function public.enforce_org_writable()
returns trigger
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_org uuid;
  v_row record := case when TG_OP = 'DELETE' then OLD else NEW end;
begin
  -- service_role / edge functions / migraciones: sin sesión de usuario.
  if auth.uid() is null then return v_row; end if;
  if public.is_super_admin() then return v_row; end if;

  v_org := public.auth_organization_id();
  if v_org is null then return v_row; end if;

  -- Un usuario bloqueado aún debe poder cambiar su contraseña (marca
  -- must_change_password) y mantener su WhatsApp; el resto de profiles no.
  if TG_TABLE_NAME = 'profiles' and TG_OP = 'UPDATE' then
    if (to_jsonb(NEW) - 'must_change_password' - 'whatsapp_number' - 'updated_at')
       = (to_jsonb(OLD) - 'must_change_password' - 'whatsapp_number' - 'updated_at') then
      return NEW;
    end if;
  end if;

  if public.org_is_locked(v_org) then
    raise exception 'CUENTA_SOLO_LECTURA: la suscripción de esta cuenta venció; solo se permite consultar. Contáctanos para reactivarla: info@narniats.com o WhatsApp 829-374-8878.'
      using errcode = 'P0001';
  end if;

  return v_row;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'appointments', 'clinical_record_team_members', 'clinical_records', 'clinics',
    'consent_templates', 'consents', 'consultations', 'patients', 'patient_diagnoses',
    'prescription_items', 'prescription_records', 'evaluation_reports', 'profiles'
  ] loop
    execute format('drop trigger if exists trg_%1$s_enforce_writable on public.%1$s', t);
    execute format(
      'create trigger trg_%1$s_enforce_writable before insert or update or delete on public.%1$s '
      'for each row execute function public.enforce_org_writable()', t);
  end loop;
end $$;

-- Archivos de informes de evaluación: mismo bloqueo (no hay trigger en storage).
drop policy if exists evaluation_reports_storage_insert on storage.objects;
create policy evaluation_reports_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'evaluation-reports'
    and (storage.foldername(name))[1] = auth_organization_id()::text
    and auth_role() = 'therapist'::user_role
    and is_care_team_member(((storage.foldername(name))[2])::uuid)
    and not public.org_is_locked(auth_organization_id())
  );

drop policy if exists evaluation_reports_storage_update on storage.objects;
create policy evaluation_reports_storage_update on storage.objects
  for update using (
    bucket_id = 'evaluation-reports'
    and (storage.foldername(name))[1] = auth_organization_id()::text
    and auth_role() = 'therapist'::user_role
    and is_care_team_member(((storage.foldername(name))[2])::uuid)
    and not public.org_is_locked(auth_organization_id())
  );

-- ----------------------------------------------------------------------------
-- 5. Registro de un pago (solo super_admin)
-- ----------------------------------------------------------------------------
-- Regla de fechas: si el período vigente aún no ha vencido al momento del
-- pago (renovación anticipada), el nuevo período se suma al final del
-- anterior; si ya venció (o nunca hubo), el período cuenta desde la fecha de
-- pago. p_covers_until permite fijar la fecha a mano (acuerdos especiales).
-- Además reactiva la cuenta: status = 'active' y subscription_status = 'active'.
create or replace function public.register_subscription_payment(
  p_organization_id uuid,
  p_amount numeric,
  p_billing_cycle text,
  p_currency text default 'DOP',
  p_paid_at timestamptz default null,
  p_plan_id uuid default null,
  p_covers_until timestamptz default null,
  p_note text default null
)
returns public.organizations
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  o public.organizations;
  v_paid_at timestamptz := coalesce(p_paid_at, now());
  v_base timestamptz;
  v_until timestamptz;
begin
  if not public.is_super_admin() then
    raise exception 'Solo el superadministrador puede registrar pagos';
  end if;
  if p_billing_cycle not in ('monthly', 'annual') then
    raise exception 'Ciclo de facturación inválido';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'Monto inválido';
  end if;

  select * into o from public.organizations where id = p_organization_id for update;
  if not found then raise exception 'Organización no encontrada'; end if;

  if o.paid_until is not null and o.paid_until > v_paid_at
     and o.subscription_status = 'active' then
    v_base := o.paid_until;
  else
    v_base := v_paid_at;
  end if;

  v_until := coalesce(
    p_covers_until,
    v_base + case when p_billing_cycle = 'annual' then interval '1 year' else interval '1 month' end
  );

  insert into public.subscription_payments (
    organization_id, plan_id, billing_cycle, amount, currency, paid_at, covers_until, note, recorded_by
  ) values (
    p_organization_id, coalesce(p_plan_id, o.plan_id), p_billing_cycle, p_amount,
    coalesce(nullif(btrim(p_currency), ''), 'DOP'), v_paid_at, v_until,
    nullif(btrim(coalesce(p_note, '')), ''), auth.uid()
  );

  update public.organizations
  set status = 'active',
      subscription_status = 'active',
      billing_cycle = p_billing_cycle,
      paid_until = v_until,
      plan_id = coalesce(p_plan_id, plan_id)
  where id = p_organization_id
  returning * into o;

  return o;
end;
$$;

revoke all on function public.register_subscription_payment(uuid, numeric, text, text, timestamptz, uuid, timestamptz, text) from public, anon;
grant execute on function public.register_subscription_payment(uuid, numeric, text, text, timestamptz, uuid, timestamptz, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 6. Perfil: WhatsApp editable por el propio usuario
-- ----------------------------------------------------------------------------
drop function if exists public.update_own_profile(text, text, text, text);

create or replace function public.update_own_profile(
  p_full_name text,
  p_phone text,
  p_license_number text,
  p_specialty text,
  p_whatsapp_number text default null
)
returns public.profiles
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_record public.profiles;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if p_full_name is null or btrim(p_full_name) = '' then
    raise exception 'El nombre no puede estar vacío';
  end if;

  update public.profiles
  set
    full_name = btrim(p_full_name),
    phone = nullif(btrim(coalesce(p_phone, '')), ''),
    license_number = nullif(btrim(coalesce(p_license_number, '')), ''),
    specialty = nullif(btrim(coalesce(p_specialty, '')), ''),
    whatsapp_number = case
      when p_whatsapp_number is null then whatsapp_number
      else nullif(btrim(p_whatsapp_number), '')
    end
  where id = auth.uid()
  returning * into v_record;

  if not found then
    raise exception 'Perfil no encontrado';
  end if;

  return v_record;
end;
$$;

grant execute on function public.update_own_profile(text, text, text, text, text) to authenticated;
