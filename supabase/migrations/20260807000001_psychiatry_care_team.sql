-- ============================================================================
-- Módulo de psiquiatría — Fases 1 (resto), 2 y 3
-- (ver plan-modulo-psiquiatria-cercana.md, secciones 2.1/2.2/3 y 6).
-- ============================================================================
-- Contenido de este archivo, en orden (el orden importa, ver sección 3.4
-- "Plan de migración segura" del plan):
--   1. clinic_required_for_clinic_staff ahora también exige clinic_id para
--      'psychiatrist' (resto de la Fase 1; el ALTER TYPE que agrega el valor
--      del enum vive en el archivo anterior, ver comentario ahí).
--   2. Tabla clinical_record_team_members ("equipo de atención") + función
--      helper is_care_team_member() + triggers de mantenimiento.
--   3. Trigger que agrega automáticamente al creador de un clinical_records
--      como primer miembro del equipo.
--   4. Backfill: todo clinical_records ya existente recibe a su
--      primary_therapist_id como miembro del equipo — ANTES de tocar las
--      políticas de RLS, para que ningún expediente existente quede sin
--      ningún miembro (y por lo tanto ilegible) tras el cambio de política.
--   5. RLS: clinical_records y consultations pasan del modelo
--      "primary_therapist_id/therapist_id = auth.uid()" al modelo de
--      membresía activa en el equipo de atención (sección 3.1/3.2).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. clinic_required_for_clinic_staff: incluir 'psychiatrist'
-- ----------------------------------------------------------------------------
alter table public.profiles drop constraint if exists clinic_required_for_clinic_staff;
alter table public.profiles add constraint clinic_required_for_clinic_staff check (
  role <> all (array['therapist','assistant','supervisor','psychiatrist']::public.user_role[])
  or clinic_id is not null
);

-- ----------------------------------------------------------------------------
-- 2. clinical_record_team_members
-- ----------------------------------------------------------------------------
create table if not exists public.clinical_record_team_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  clinical_record_id uuid not null references public.clinical_records(id),
  clinician_id uuid not null references public.profiles(id),
  role_in_team text,
  active boolean not null default true,
  added_by uuid references public.profiles(id),
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinical_record_id, clinician_id)
);

create index if not exists idx_team_members_clinical_record
  on public.clinical_record_team_members using btree (clinical_record_id);
create index if not exists idx_team_members_clinician
  on public.clinical_record_team_members using btree (clinician_id);
create index if not exists idx_team_members_org
  on public.clinical_record_team_members using btree (organization_id);

-- Autocompleta organization_id (desde el clinical_record referenciado) y
-- role_in_team (desde profiles.role) cuando el insertador no los provee —
-- así el frontend (Fase 6) puede insertar solo clinical_record_id +
-- clinician_id sin tener que resolver esos valores por su cuenta.
create or replace function public.fill_team_member_defaults()
returns trigger
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if NEW.organization_id is null then
    select organization_id into NEW.organization_id
    from public.clinical_records where id = NEW.clinical_record_id;
  end if;

  if NEW.role_in_team is null then
    select role::text into NEW.role_in_team
    from public.profiles where id = NEW.clinician_id;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_team_members_fill_defaults on public.clinical_record_team_members;
create trigger trg_team_members_fill_defaults
  before insert on public.clinical_record_team_members
  for each row execute function public.fill_team_member_defaults();

drop trigger if exists trg_team_members_updated_at on public.clinical_record_team_members;
create trigger trg_team_members_updated_at before update on public.clinical_record_team_members
  for each row execute function public.set_updated_at();

drop trigger if exists trg_audit_team_members on public.clinical_record_team_members;
create trigger trg_audit_team_members after insert or update or delete on public.clinical_record_team_members
  for each row execute function public.log_audit_event();

-- Helper SECURITY DEFINER: ¿el usuario autenticado es miembro activo del
-- equipo de atención de este clinical_record? Se usa desde las policies de
-- clinical_records/consultations/clinical_record_team_members. Al ser
-- SECURITY DEFINER, la consulta interna no queda sujeta a la propia RLS de
-- clinical_record_team_members (evita el problema de que una policy
-- necesite leer la tabla que ella misma protege).
create or replace function public.is_care_team_member(p_clinical_record_id uuid)
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from clinical_record_team_members
    where clinical_record_id = p_clinical_record_id
      and clinician_id = auth.uid()
      and active
  );
$$;

-- ----------------------------------------------------------------------------
-- 3. Auto-inclusión del creador como primer miembro del equipo
-- ----------------------------------------------------------------------------
create or replace function public.add_creator_to_care_team()
returns trigger
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  insert into public.clinical_record_team_members
    (clinical_record_id, clinician_id, organization_id, role_in_team, active, added_by, added_at)
  select
    NEW.id,
    NEW.primary_therapist_id,
    NEW.organization_id,
    p.role::text,
    true,
    coalesce(NEW.created_by, NEW.primary_therapist_id),
    NEW.created_at
  from public.profiles p
  where p.id = NEW.primary_therapist_id
  on conflict (clinical_record_id, clinician_id) do nothing;

  return NEW;
end;
$$;

drop trigger if exists trg_clinical_records_add_creator_to_team on public.clinical_records;
create trigger trg_clinical_records_add_creator_to_team
  after insert on public.clinical_records
  for each row execute function public.add_creator_to_care_team();

-- ----------------------------------------------------------------------------
-- 4. Backfill — antes de tocar RLS (ver cabecera del archivo)
-- ----------------------------------------------------------------------------
insert into public.clinical_record_team_members
  (clinical_record_id, clinician_id, organization_id, role_in_team, active, added_by, added_at)
select
  cr.id,
  cr.primary_therapist_id,
  cr.organization_id,
  p.role::text,
  true,
  coalesce(cr.created_by, cr.primary_therapist_id),
  cr.created_at
from public.clinical_records cr
join public.profiles p on p.id = cr.primary_therapist_id
on conflict (clinical_record_id, clinician_id) do nothing;

-- ----------------------------------------------------------------------------
-- 5. RLS de clinical_record_team_members
-- ----------------------------------------------------------------------------
alter table public.clinical_record_team_members enable row level security;

drop policy if exists team_members_select on public.clinical_record_team_members;
create policy team_members_select on public.clinical_record_team_members
  for select using (
    organization_id = auth_organization_id()
    and (
      is_care_team_member(clinical_record_id)
      or auth_role() = 'org_admin'::user_role
      or (
        auth_role() = 'supervisor'::user_role
        and exists (
          select 1 from clinical_records cr
          where cr.id = clinical_record_team_members.clinical_record_id
            and (auth_clinic_id() is null or cr.clinic_id = auth_clinic_id())
        )
      )
    )
  );

drop policy if exists team_members_insert on public.clinical_record_team_members;
create policy team_members_insert on public.clinical_record_team_members
  for insert with check (
    organization_id = auth_organization_id()
    and (is_care_team_member(clinical_record_id) or auth_role() = 'org_admin'::user_role)
    and exists (
      select 1 from profiles p
      where p.id = clinician_id
        and p.organization_id = auth_organization_id()
        and p.active
    )
  );

drop policy if exists team_members_update on public.clinical_record_team_members;
create policy team_members_update on public.clinical_record_team_members
  for update using (
    organization_id = auth_organization_id()
    and (is_care_team_member(clinical_record_id) or auth_role() = 'org_admin'::user_role)
  );

-- ----------------------------------------------------------------------------
-- 6. RLS de clinical_records — modelo de equipo (sección 3.1 del plan)
-- ----------------------------------------------------------------------------
drop policy if exists clinical_records_select on public.clinical_records;
create policy clinical_records_select on public.clinical_records
  for select using (
    organization_id = auth_organization_id()
    and (
      is_care_team_member(id)
      or (auth_role() = 'supervisor'::user_role and (auth_clinic_id() is null or clinic_id = auth_clinic_id()))
    )
  );

drop policy if exists clinical_records_update on public.clinical_records;
create policy clinical_records_update on public.clinical_records
  for update using (
    organization_id = auth_organization_id() and is_care_team_member(id)
  );

-- INSERT: se amplía de solo 'therapist' a 'therapist'/'psychiatrist' — un
-- psiquiatra también puede abrir un caso nuevo (ser el primer clínico de un
-- paciente), no solo unirse a uno existente. Sigue exigiendo
-- primary_therapist_id = auth.uid() (quien crea el expediente es su primer
-- responsable) y la unicidad por paciente (unique(patient_id), ya existente)
-- sigue impidiendo duplicar el expediente de un paciente que ya tiene uno.
drop policy if exists clinical_records_insert on public.clinical_records;
create policy clinical_records_insert on public.clinical_records
  for insert with check (
    organization_id = auth_organization_id()
    and auth_role() = any (array['therapist','psychiatrist']::user_role[])
    and primary_therapist_id = auth.uid()
  );

-- ----------------------------------------------------------------------------
-- 7. RLS de consultations — modelo de equipo (sección 3.2 del plan)
-- ----------------------------------------------------------------------------
-- SELECT: cualquier miembro activo del equipo del clinical_record lee las
-- notas de todos los miembros (antes: solo el autor). La escritura sigue
-- restringida al autor (consultations_update no cambia).
drop policy if exists consultations_select on public.consultations;
create policy consultations_select on public.consultations
  for select using (
    organization_id = auth_organization_id()
    and (
      is_care_team_member(clinical_record_id)
      or (auth_role() = 'supervisor'::user_role and (auth_clinic_id() is null or clinic_id = auth_clinic_id()))
    )
  );

-- INSERT: se amplía de solo 'therapist' a 'therapist'/'psychiatrist', y el
-- chequeo de pertenencia pasa de "cr.primary_therapist_id = auth.uid()" a
-- "es miembro activo del equipo de ese clinical_record" — así un miembro
-- del equipo que no sea el primary_therapist_id (por ejemplo el psiquiatra
-- que se sumó a un caso abierto por un terapeuta) también puede registrar
-- sus propias consultas. Se mantiene el chequeo de que clinical_record_id
-- corresponda de verdad al patient_id/organization_id de la fila (fix de
-- 20260802210000_fix_consultations_insert_policy.sql).
drop policy if exists consultations_insert on public.consultations;
create policy consultations_insert on public.consultations
  for insert with check (
    organization_id = auth_organization_id()
    and auth_role() = any (array['therapist','psychiatrist']::user_role[])
    and therapist_id = auth.uid()
    and exists (
      select 1 from clinical_records cr
      where cr.id = consultations.clinical_record_id
        and cr.patient_id = consultations.patient_id
        and cr.organization_id = consultations.organization_id
    )
    and is_care_team_member(consultations.clinical_record_id)
  );

-- consultations_update: sin cambios (se mantiene restringida al autor,
-- therapist_id = auth.uid() — ver sección 3.2 del plan, "la escritura se
-- mantiene restringida solo al autor de cada nota").
