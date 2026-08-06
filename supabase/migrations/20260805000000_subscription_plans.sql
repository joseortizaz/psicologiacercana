-- ============================================================================
-- Planes de suscripción: hasta ahora los 5 planes mostrados en la landing
-- page (Esencial, Dúo Clínico, Profesional Plus, Clínica en Crecimiento,
-- Institucional) vivían solo como HTML/CSS en components/LandingClient.tsx,
-- sin ninguna relación con la base de datos. organizations.plan era apenas
-- una etiqueta genérica (trial/basic/professional/enterprise) sin nombre
-- comercial, precio ni límites de personal.
--
-- Esta migración:
--   1. Crea public.plans con los 5 planes reales (nombre, tagline, precio
--      mensual/anual en RD$, límites por rol, features) para que el
--      super_admin pueda gestionarlos desde la app.
--   2. Reemplaza organizations.plan (enum) por organizations.plan_id (FK a
--      plans), migrando los datos existentes.
--   3. Agrega un trigger sobre profiles que bloquea invitar/activar más
--      personal del que el plan de la organización permite por rol.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabla plans
-- ----------------------------------------------------------------------------
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  tagline text,
  monthly_price numeric(10,2),
  annual_price numeric(10,2),
  currency text not null default 'DOP',
  is_custom boolean not null default false,
  max_therapists integer,
  max_org_admins integer,
  max_assistants integer,
  max_supervisors integer,
  features text[] not null default '{}',
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plans_prices_non_negative check (
    (monthly_price is null or monthly_price >= 0) and
    (annual_price is null or annual_price >= 0)
  ),
  constraint plans_limits_non_negative check (
    (max_therapists is null or max_therapists >= 0) and
    (max_org_admins is null or max_org_admins >= 0) and
    (max_assistants is null or max_assistants >= 0) and
    (max_supervisors is null or max_supervisors >= 0)
  )
);

alter table if exists public.plans enable row level security;

drop trigger if exists trg_plans_updated_at on public.plans;
create trigger trg_plans_updated_at before update on public.plans
  for each row execute function public.set_updated_at();

-- Límites basados en la sección "Planes" de la landing page
-- (components/LandingClient.tsx). max_org_admins = 1 en los planes A/B
-- porque el alta de una organización siempre crea un org_admin (ver
-- supabase/functions/onboard-organization); ahí no se menciona
-- "administrador" como feature aparte hasta el plan C.
insert into public.plans
  (code, name, tagline, monthly_price, annual_price, is_custom,
   max_therapists, max_org_admins, max_assistants, max_supervisors,
   features, display_order)
values
  ('esencial', 'Esencial', 'Terapeuta independiente', 990.00, 10098.00, false,
   1, 1, 0, 0,
   array['1 terapeuta','Expediente clínico y agenda','Firma digital de consentimientos','Soporte por correo'],
   1),
  ('duo_clinico', 'Dúo Clínico', 'Dos terapeutas', 1590.00, 16218.00, false,
   2, 1, 0, 0,
   array['2 terapeutas','Todo lo del plan Esencial','Agenda compartida','Soporte prioritario'],
   2),
  ('profesional_plus', 'Profesional Plus', 'Equipo pequeño: 3 a 5 terapeutas', 2590.00, 26418.00, false,
   5, 1, 1, 1,
   array['3 a 5 terapeutas','1 administrador','1 asistente administrativa','1 supervisor clínico','Reportes avanzados'],
   3),
  ('clinica_crecimiento', 'Clínica en Crecimiento', '6 a 10 terapeutas', 4490.00, 45798.00, false,
   10, 1, 2, 2,
   array['6 a 10 terapeutas','1 administrador','2 asistentes administrativas','2 supervisores clínicos','Reportes avanzados'],
   4),
  ('institucional', 'Institucional', 'Equipos en desarrollo: 11 o más terapeutas', null, null, true,
   null, null, null, null,
   array['Planes personalizados','Roles y permisos flexibles','Acompañamiento dedicado','Integración con tu clínica'],
   5)
on conflict (code) do nothing;

-- ----------------------------------------------------------------------------
-- 2. organizations: reemplazar el enum "plan" por una FK a plans
-- ----------------------------------------------------------------------------
alter table public.organizations add column if not exists plan_id uuid references public.plans(id);

-- trial/basic no tenían límites reales asociados; se migran al plan pagado
-- más bajo (Esencial) como punto de partida razonable. professional/
-- enterprise mapean 1:1 a su equivalente más cercano en la nueva lista.
update public.organizations o
set plan_id = p.id
from public.plans p
where o.plan_id is null
  and p.code = case o.plan
    when 'trial' then 'esencial'
    when 'basic' then 'esencial'
    when 'professional' then 'profesional_plus'
    when 'enterprise' then 'institucional'
  end;

create or replace function public.default_plan_id()
returns uuid
language sql stable
set search_path to 'public', 'pg_temp'
as $$
  select id from public.plans where code = 'esencial' limit 1;
$$;

alter table public.organizations alter column plan_id set default public.default_plan_id();
alter table public.organizations alter column plan_id set not null;

alter table public.organizations drop column if exists plan;
drop type if exists public.organization_plan;

-- ----------------------------------------------------------------------------
-- 3. Enforcement: bloquear altas de personal por encima del límite del plan
-- ----------------------------------------------------------------------------
create or replace function public.enforce_plan_limits()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_plan_id uuid;
  v_max integer;
  v_count integer;
  v_role_label text;
begin
  -- Solo aplica a filas activas con un rol contemplado por los planes.
  if NEW.active is not true then
    return NEW;
  end if;
  if NEW.role not in ('org_admin','therapist','assistant','supervisor') then
    return NEW;
  end if;

  -- En UPDATE, solo re-evaluar si algo relevante para el conteo cambió
  -- (evita que update_own_profile u otros UPDATE inocuos disparen el check).
  if TG_OP = 'UPDATE'
    and OLD.role = NEW.role
    and OLD.organization_id = NEW.organization_id
    and OLD.active = NEW.active
  then
    return NEW;
  end if;

  select plan_id into v_plan_id from public.organizations where id = NEW.organization_id;
  if v_plan_id is null then
    return NEW;
  end if;

  if NEW.role = 'therapist' then
    select max_therapists into v_max from public.plans where id = v_plan_id;
    v_role_label := 'terapeutas';
  elsif NEW.role = 'org_admin' then
    select max_org_admins into v_max from public.plans where id = v_plan_id;
    v_role_label := 'administradores';
  elsif NEW.role = 'assistant' then
    select max_assistants into v_max from public.plans where id = v_plan_id;
    v_role_label := 'asistentes administrativas';
  elsif NEW.role = 'supervisor' then
    select max_supervisors into v_max from public.plans where id = v_plan_id;
    v_role_label := 'supervisores clínicos';
  end if;

  -- NULL = sin límite (plan personalizado / institucional).
  if v_max is null then
    return NEW;
  end if;

  select count(*) into v_count
  from public.profiles
  where organization_id = NEW.organization_id
    and role = NEW.role
    and active = true
    and id <> coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_count >= v_max then
    raise exception 'El plan actual permite un máximo de % % activos por organización. Actualice el plan para agregar más.', v_max, v_role_label;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_enforce_plan_limits on public.profiles;
create trigger trg_enforce_plan_limits before insert or update on public.profiles
  for each row execute function public.enforce_plan_limits();

-- ----------------------------------------------------------------------------
-- 4. RLS de plans: lectura para cualquier autenticado (se usa para mostrar
--    nombre/límites del plan en paneles de org_admin), escritura solo
--    super_admin.
-- ----------------------------------------------------------------------------
drop policy if exists plans_select on public.plans;
create policy plans_select on public.plans
  for select using (auth.uid() is not null);

drop policy if exists plans_insert on public.plans;
create policy plans_insert on public.plans
  for insert with check (is_super_admin());

drop policy if exists plans_update on public.plans;
create policy plans_update on public.plans
  for update using (is_super_admin());

drop policy if exists plans_delete on public.plans;
create policy plans_delete on public.plans
  for delete using (is_super_admin());
