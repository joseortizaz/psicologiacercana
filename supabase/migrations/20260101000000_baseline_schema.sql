-- ============================================================================
-- BASELINE SCHEMA — PsyClinic Cloud
-- ============================================================================
-- Este archivo NO crea nada nuevo: reconstruye, para control de versiones,
-- el esquema que ya existe en el proyecto de Supabase (fue creado
-- originalmente fuera de este repo, directo contra la base). Se reconstruyó
-- por introspección (information_schema, pg_catalog, pg_get_functiondef,
-- pg_get_constraintdef) el 2026-08-02.
--
-- Este archivo se marca como "aplicado" vía `supabase migration repair`
-- SIN ejecutarse contra producción (el esquema ya existe ahí). Sirve como
-- punto de partida para:
--   1. `supabase db pull`/`db diff` a partir de aquí sin choques.
--   2. Levantar una base de datos de pruebas idéntica en CI (pgTAP).
--   3. Documentación versionada del modelo real (secciones 2 y 3 del plan).
--
-- Notas de fidelidad (cosas que no se pudieron confirmar por introspección
-- y quedaron como mejor esfuerzo, revisar si la exactitud importa):
--   - `profiles.id`: no se detectó una FK explícita hacia auth.users(id) en
--     el escaneo de information_schema.table_constraints. Se declara aquí
--     sin esa FK, tal como se observó. Si en producción sí existe, ajustar.
--   - El event trigger que llama a rls_auto_enable() existe en producción
--     (la función sí se recuperó completa), pero no se pudo listar su
--     nombre/definición exacta de registro. Se reconstruye con un nombre
--     razonable; si CI falla por "already exists", ajustar o quitar.
--   - `appointments_no_overlap`: la introspección original (2026-08-02) lo
--     detectó como un simple índice GIST, no un EXCLUDE constraint, así que
--     se replicó aquí como índice. Al aplicar la migración
--     20260803000000_appointments_no_overlap_exclude.sql contra producción
--     (2026-08-03) se descubrió que esa lectura era incorrecta: producción
--     YA tenía un EXCLUDE constraint real con ese nombre y esa definición
--     exacta. Se deja el índice tal cual aquí (no se corrige, por fidelidad
--     histórica de este archivo) porque la migración de conversión ahora es
--     idempotente: si el EXCLUDE constraint ya existe no hace nada, y si
--     solo hay un índice (como en un CI limpio levantado desde este mismo
--     baseline) lo convierte.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Extensiones
-- ----------------------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "citext";
create extension if not exists "btree_gist";
create extension if not exists "pgtap" schema extensions;

-- ----------------------------------------------------------------------------
-- 1. Tipos enumerados
-- ----------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('super_admin','org_admin','therapist','assistant','supervisor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.organization_plan as enum ('trial','basic','professional','enterprise');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.organization_status as enum ('active','suspended','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.appointment_status as enum ('scheduled','confirmed','completed','cancelled','no_show');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.case_status as enum ('active','in_treatment','discharged','suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.consultation_modality as enum ('in_person','virtual','phone');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.consultation_session_type as enum ('individual','family','couple','group');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.consultation_status as enum ('draft','finalized');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.note_format as enum ('soap','dap','free');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.patient_category as enum ('child','adolescent','adult');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.consent_type as enum (
    'data_treatment','treatment_informed_consent','teleconsultation',
    'session_recording','minor_guardian_authorization'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.consent_status as enum ('pending','signed','declined','revoked','expired');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 2. Tablas (orden de dependencia)
-- ----------------------------------------------------------------------------

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  tax_id text,
  plan public.organization_plan not null default 'trial',
  status public.organization_status not null default 'active',
  billing_email citext,
  country text not null default 'DO',
  timezone text not null default 'America/Santo_Domingo',
  trial_ends_at timestamptz,
  max_clinics integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  address text,
  phone text,
  email citext,
  timezone text,
  logo_url text,
  primary_color text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

-- Nota de fidelidad: no se detectó FK explícita profiles.id -> auth.users(id)
-- en el escaneo. Se deja sin esa FK, igual que en producción.
create table if not exists public.profiles (
  id uuid primary key,
  organization_id uuid references public.organizations(id),
  clinic_id uuid references public.clinics(id),
  role public.user_role not null,
  full_name text not null,
  email citext not null,
  phone text,
  license_number text,
  specialty text,
  avatar_url text,
  active boolean not null default true,
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinic_required_for_clinic_staff check (
    role <> all (array['therapist','assistant','supervisor']::public.user_role[])
    or clinic_id is not null
  ),
  constraint org_required_unless_super_admin check (
    role = 'super_admin'::public.user_role or organization_id is not null
  )
);
create unique index if not exists idx_profiles_email on public.profiles using btree (email);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  clinic_id uuid not null references public.clinics(id),
  full_name text not null,
  date_of_birth date not null,
  category public.patient_category not null,
  national_id text,
  gender text,
  contact_phone text,
  contact_email citext,
  address text,
  occupation text,
  education_level text,
  referred_by text,
  insurance_provider text,
  insurance_policy_number text,
  guardian_name text,
  guardian_relationship text,
  guardian_phone text,
  guardian_national_id text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text,
  tags text[] not null default '{}',
  photo_url text,
  primary_therapist_id uuid references public.profiles(id),
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- OJO: UNIQUE(patient_id) — solo puede existir UN expediente clínico por
-- paciente en todo el sistema (no uno por paciente+terapeuta). Ver nota al
-- usuario sobre el impacto en la UI del panel de terapeuta.
create table if not exists public.clinical_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  clinic_id uuid not null references public.clinics(id),
  patient_id uuid not null references public.patients(id),
  primary_therapist_id uuid not null references public.profiles(id),
  status public.case_status not null default 'active',
  chief_complaint text,
  diagnosis text,
  diagnosis_hypothesis text,
  therapeutic_objectives text,
  treatment_plan text,
  medications text[] not null default '{}',
  allergies text[] not null default '{}',
  history_sections jsonb not null default '{}',
  sensitive_history jsonb not null default '{}',
  discharge_date date,
  discharge_summary text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id)
);

-- appointments y consultations se referencian mutuamente; se crea
-- appointments primero sin la FK hacia consultations, y se agrega esa FK
-- después de crear consultations.
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  clinic_id uuid not null references public.clinics(id),
  patient_id uuid not null references public.patients(id),
  therapist_id uuid not null references public.profiles(id),
  clinical_record_id uuid references public.clinical_records(id),
  consultation_id uuid,
  start_time timestamptz not null,
  end_time timestamptz not null,
  modality public.consultation_modality not null default 'in_person',
  session_type public.consultation_session_type not null default 'individual',
  status public.appointment_status not null default 'scheduled',
  reason text,
  notes text,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id),
  cancellation_reason text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_valid_range check (end_time > start_time)
);

create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  clinic_id uuid not null references public.clinics(id),
  patient_id uuid not null references public.patients(id),
  clinical_record_id uuid not null references public.clinical_records(id),
  therapist_id uuid not null references public.profiles(id),
  session_date timestamptz not null default now(),
  duration_minutes integer,
  modality public.consultation_modality not null default 'in_person',
  session_type public.consultation_session_type not null default 'individual',
  reason text,
  objectives text,
  interventions text,
  techniques_used text[] not null default '{}',
  note_format public.note_format not null default 'soap',
  note_content jsonb not null default '{}',
  homework_tasks text,
  next_appointment_date date,
  observations text,
  attachments jsonb not null default '[]',
  status public.consultation_status not null default 'draft',
  signed_at timestamptz,
  signed_by uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  appointment_id uuid references public.appointments(id)
);

alter table public.appointments
  drop constraint if exists appointments_consultation_id_fkey;
alter table public.appointments
  add constraint appointments_consultation_id_fkey
  foreign key (consultation_id) references public.consultations(id);

create table if not exists public.consent_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  consent_type public.consent_type not null,
  version integer not null,
  title text not null,
  body text not null,
  includes_international_transfer_clause boolean not null default false,
  effective_date date not null default current_date,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, consent_type, version)
);

create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  clinic_id uuid not null references public.clinics(id),
  patient_id uuid not null references public.patients(id),
  consent_template_id uuid not null references public.consent_templates(id),
  consent_type public.consent_type not null,
  signer_name text not null,
  signer_relationship text not null default 'self',
  signer_national_id text,
  status public.consent_status not null default 'pending',
  provider text,
  external_reference_id text,
  signed_document_url text,
  verification_hash text,
  signed_at timestamptz,
  signer_ip_address inet,
  signer_user_agent text,
  revoked_at timestamptz,
  revoked_reason text,
  revoked_by uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  organization_id uuid,
  table_name text not null,
  record_id uuid not null,
  action text not null,
  occurred_at timestamptz not null default now(),
  constraint audit_logs_action_check check (action = any (array['INSERT','UPDATE','DELETE','SELECT']))
);
revoke update, delete on public.audit_logs from authenticated, anon;

-- ----------------------------------------------------------------------------
-- 3. Índices adicionales (no derivados de PK/UNIQUE)
-- ----------------------------------------------------------------------------
create index if not exists idx_clinics_org on public.clinics using btree (organization_id);

create index if not exists idx_profiles_org on public.profiles using btree (organization_id);
create index if not exists idx_profiles_org_role on public.profiles using btree (organization_id, role);
create index if not exists idx_profiles_clinic on public.profiles using btree (clinic_id);

create index if not exists idx_patients_org on public.patients using btree (organization_id);
create index if not exists idx_patients_clinic on public.patients using btree (clinic_id);
create index if not exists idx_patients_therapist on public.patients using btree (primary_therapist_id);
create index if not exists idx_patients_active on public.patients using btree (organization_id, active);

create index if not exists idx_clinical_records_org on public.clinical_records using btree (organization_id);
create index if not exists idx_clinical_records_clinic on public.clinical_records using btree (clinic_id);
create index if not exists idx_clinical_records_therapist on public.clinical_records using btree (primary_therapist_id);
create index if not exists idx_clinical_records_status on public.clinical_records using btree (organization_id, status);

create index if not exists idx_consultations_org on public.consultations using btree (organization_id);
create index if not exists idx_consultations_clinic on public.consultations using btree (clinic_id);
create index if not exists idx_consultations_patient on public.consultations using btree (patient_id);
create index if not exists idx_consultations_clinical_record on public.consultations using btree (clinical_record_id);
create index if not exists idx_consultations_therapist on public.consultations using btree (therapist_id);
create index if not exists idx_consultations_date on public.consultations using btree (organization_id, session_date desc);
create index if not exists idx_consultations_appointment on public.consultations using btree (appointment_id);

create index if not exists idx_appointments_org on public.appointments using btree (organization_id);
create index if not exists idx_appointments_clinic on public.appointments using btree (clinic_id);
create index if not exists idx_appointments_therapist_time on public.appointments using btree (therapist_id, start_time);
create index if not exists idx_appointments_patient on public.appointments using btree (patient_id);
create index if not exists idx_appointments_status on public.appointments using btree (organization_id, status);
-- Índice GIST de apoyo (NO es un EXCLUDE constraint: no impide traslapes).
create index if not exists appointments_no_overlap on public.appointments
  using gist (therapist_id, tstzrange(start_time, end_time))
  where (status <> 'cancelled'::public.appointment_status);

create index if not exists idx_consent_templates_org_type on public.consent_templates using btree (organization_id, consent_type);

create index if not exists idx_consents_org on public.consents using btree (organization_id);
create index if not exists idx_consents_clinic on public.consents using btree (clinic_id);
create index if not exists idx_consents_patient on public.consents using btree (patient_id);
create index if not exists idx_consents_status on public.consents using btree (organization_id, status);
create index if not exists idx_consents_type on public.consents using btree (organization_id, consent_type);

create index if not exists idx_audit_logs_org on public.audit_logs using btree (organization_id);
create index if not exists idx_audit_logs_record on public.audit_logs using btree (table_name, record_id);

-- ----------------------------------------------------------------------------
-- 4. Funciones helper (SECURITY DEFINER)
-- ----------------------------------------------------------------------------

create or replace function public.auth_organization_id()
returns uuid
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select organization_id from profiles where id = auth.uid() and active;
$$;

create or replace function public.auth_role()
returns public.user_role
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select role from profiles where id = auth.uid() and active;
$$;

create or replace function public.auth_clinic_id()
returns uuid
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select clinic_id from profiles where id = auth.uid() and active;
$$;

create or replace function public.is_org_admin_or_super()
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and active and role in ('org_admin','super_admin')
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and active and role = 'super_admin'
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.log_audit_event()
returns trigger
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_org_id uuid;
  v_record_id uuid;
begin
  if TG_OP = 'DELETE' then
    v_org_id := OLD.organization_id;
    v_record_id := OLD.id;
  else
    v_org_id := NEW.organization_id;
    v_record_id := NEW.id;
  end if;

  insert into audit_logs (actor_id, organization_id, table_name, record_id, action)
  values (auth.uid(), v_org_id, TG_TABLE_NAME, v_record_id, TG_OP);

  if TG_OP = 'DELETE' then
    return OLD;
  else
    return NEW;
  end if;
end;
$$;

create or replace function public.prevent_finalized_consultation_edit()
returns trigger
language plpgsql
as $$
begin
  if OLD.status = 'finalized' then
    raise exception 'No se puede modificar una consulta ya finalizada/firmada (id: %). Registre una nueva consulta de seguimiento en su lugar.', OLD.id;
  end if;
  return NEW;
end;
$$;

create or replace function public.validate_consent_signer()
returns trigger
language plpgsql
as $$
declare
  v_category patient_category;
begin
  select category into v_category from patients where id = NEW.patient_id;

  if v_category is distinct from 'adult' and NEW.signer_relationship = 'self' and NEW.status = 'signed' then
    raise exception 'El paciente % no es adulto (categoría: %); el consentimiento debe firmarlo un tutor, no el propio paciente.', NEW.patient_id, v_category;
  end if;

  return NEW;
end;
$$;

create or replace function public.admin_read_clinical_record(p_clinical_record_id uuid)
returns clinical_records
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_record clinical_records;
begin
  if auth_role() <> 'org_admin' then
    raise exception 'Solo org_admin puede usar esta función de acceso elevado';
  end if;

  select * into v_record
  from clinical_records
  where id = p_clinical_record_id
    and organization_id = auth_organization_id();

  if not found then
    raise exception 'Expediente clínico no encontrado o fuera de tu organización';
  end if;

  insert into audit_logs (actor_id, organization_id, table_name, record_id, action)
  values (auth.uid(), v_record.organization_id, 'clinical_records', v_record.id, 'SELECT');

  return v_record;
end;
$$;

create or replace function public.admin_read_consultation(p_consultation_id uuid)
returns consultations
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_record consultations;
begin
  if auth_role() <> 'org_admin' then
    raise exception 'Solo org_admin puede usar esta función de acceso elevado';
  end if;

  select * into v_record
  from consultations
  where id = p_consultation_id
    and organization_id = auth_organization_id();

  if not found then
    raise exception 'Consulta no encontrada o fuera de tu organización';
  end if;

  insert into audit_logs (actor_id, organization_id, table_name, record_id, action)
  values (auth.uid(), v_record.organization_id, 'consultations', v_record.id, 'SELECT');

  return v_record;
end;
$$;

-- Reconstrucción de mejor esfuerzo: la función existe en producción tal
-- cual (recuperada por introspección), pero el EVENT TRIGGER que la invoca
-- no se pudo listar con certeza. Se crea la función; el event trigger de
-- abajo es una reconstrucción razonable basada en la lógica de la función.
create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql security definer
set search_path to 'pg_catalog'
as $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;

do $$ begin
  create event trigger rls_auto_enable_trigger
    on ddl_command_end
    when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
    execute function public.rls_auto_enable();
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 5. Triggers
-- ----------------------------------------------------------------------------

drop trigger if exists trg_organizations_updated_at on public.organizations;
create trigger trg_organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();

drop trigger if exists trg_clinics_updated_at on public.clinics;
create trigger trg_clinics_updated_at before update on public.clinics
  for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_clinics on public.clinics;
create trigger trg_audit_clinics after insert or update or delete on public.clinics
  for each row execute function public.log_audit_event();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_profiles on public.profiles;
create trigger trg_audit_profiles after insert or update or delete on public.profiles
  for each row execute function public.log_audit_event();

drop trigger if exists trg_patients_updated_at on public.patients;
create trigger trg_patients_updated_at before update on public.patients
  for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_patients on public.patients;
create trigger trg_audit_patients after insert or update or delete on public.patients
  for each row execute function public.log_audit_event();

drop trigger if exists trg_clinical_records_updated_at on public.clinical_records;
create trigger trg_clinical_records_updated_at before update on public.clinical_records
  for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_clinical_records on public.clinical_records;
create trigger trg_audit_clinical_records after insert or update or delete on public.clinical_records
  for each row execute function public.log_audit_event();

drop trigger if exists trg_appointments_updated_at on public.appointments;
create trigger trg_appointments_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_appointments on public.appointments;
create trigger trg_audit_appointments after insert or update or delete on public.appointments
  for each row execute function public.log_audit_event();

drop trigger if exists trg_consultations_updated_at on public.consultations;
create trigger trg_consultations_updated_at before update on public.consultations
  for each row execute function public.set_updated_at();
drop trigger if exists trg_consultations_prevent_finalized_edit on public.consultations;
create trigger trg_consultations_prevent_finalized_edit before update on public.consultations
  for each row execute function public.prevent_finalized_consultation_edit();
drop trigger if exists trg_audit_consultations on public.consultations;
create trigger trg_audit_consultations after insert or update or delete on public.consultations
  for each row execute function public.log_audit_event();

drop trigger if exists trg_consent_templates_updated_at on public.consent_templates;
create trigger trg_consent_templates_updated_at before update on public.consent_templates
  for each row execute function public.set_updated_at();

drop trigger if exists trg_consents_updated_at on public.consents;
create trigger trg_consents_updated_at before update on public.consents
  for each row execute function public.set_updated_at();
drop trigger if exists trg_validate_consent_signer on public.consents;
create trigger trg_validate_consent_signer before insert or update on public.consents
  for each row execute function public.validate_consent_signer();
drop trigger if exists trg_audit_consents on public.consents;
create trigger trg_audit_consents after insert or update or delete on public.consents
  for each row execute function public.log_audit_event();

-- ----------------------------------------------------------------------------
-- 6. Row Level Security
-- ----------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.clinics enable row level security;
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.clinical_records enable row level security;
alter table public.consultations enable row level security;
alter table public.appointments enable row level security;
alter table public.consent_templates enable row level security;
alter table public.consents enable row level security;
alter table public.audit_logs enable row level security;

-- organizations
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
  for select using (id = auth_organization_id() or is_super_admin());

drop policy if exists organizations_update_super_admin on public.organizations;
create policy organizations_update_super_admin on public.organizations
  for update using (is_super_admin());

-- clinics
drop policy if exists clinics_select on public.clinics;
create policy clinics_select on public.clinics
  for select using (organization_id = auth_organization_id() or is_super_admin());

drop policy if exists clinics_insert on public.clinics;
create policy clinics_insert on public.clinics
  for insert with check (
    (organization_id = auth_organization_id() and is_org_admin_or_super()) or is_super_admin()
  );

drop policy if exists clinics_update on public.clinics;
create policy clinics_update on public.clinics
  for update using (
    (organization_id = auth_organization_id() and is_org_admin_or_super()) or is_super_admin()
  );

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (organization_id = auth_organization_id() or is_super_admin());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (
    (organization_id = auth_organization_id() and is_org_admin_or_super()) or is_super_admin()
  );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (
    (organization_id = auth_organization_id() and is_org_admin_or_super()) or is_super_admin()
  );

-- patients
drop policy if exists patients_select on public.patients;
create policy patients_select on public.patients
  for select using (
    organization_id = auth_organization_id()
    and (auth_clinic_id() is null or clinic_id = auth_clinic_id())
  );

drop policy if exists patients_insert on public.patients;
create policy patients_insert on public.patients
  for insert with check (
    organization_id = auth_organization_id()
    and auth_role() = any (array['assistant','therapist','org_admin']::user_role[])
    and (auth_clinic_id() is null or clinic_id = auth_clinic_id())
  );

drop policy if exists patients_update on public.patients;
create policy patients_update on public.patients
  for update using (
    organization_id = auth_organization_id()
    and auth_role() = any (array['assistant','therapist','org_admin']::user_role[])
    and (auth_clinic_id() is null or clinic_id = auth_clinic_id())
  );

-- clinical_records
drop policy if exists clinical_records_select on public.clinical_records;
create policy clinical_records_select on public.clinical_records
  for select using (
    organization_id = auth_organization_id()
    and (
      primary_therapist_id = auth.uid()
      or (auth_role() = 'supervisor'::user_role and (auth_clinic_id() is null or clinic_id = auth_clinic_id()))
    )
  );

drop policy if exists clinical_records_insert on public.clinical_records;
create policy clinical_records_insert on public.clinical_records
  for insert with check (
    organization_id = auth_organization_id()
    and auth_role() = 'therapist'::user_role
    and primary_therapist_id = auth.uid()
  );

drop policy if exists clinical_records_update on public.clinical_records;
create policy clinical_records_update on public.clinical_records
  for update using (
    organization_id = auth_organization_id() and primary_therapist_id = auth.uid()
  );

-- consultations
-- Nota: la condición EXISTS de esta policy, tal como existía en producción
-- al momento de esta reconstrucción, comparaba `cr.patient_id = cr.patient_id`
-- y `cr.organization_id = cr.organization_id` (columna contra sí misma) en
-- vez de contra `consultations.patient_id` / `consultations.organization_id`.
-- Se replica TAL CUAL aquí para que este archivo sea fiel a lo que existía en
-- ese momento. El bug se corrige en la migración posterior
-- 20260802210000_fix_consultations_insert_policy.sql — no se corrige aquí
-- para no reescribir la historia de lo que había en producción.
drop policy if exists consultations_insert on public.consultations;
create policy consultations_insert on public.consultations
  for insert with check (
    organization_id = auth_organization_id()
    and auth_role() = 'therapist'::user_role
    and therapist_id = auth.uid()
    and exists (
      select 1 from clinical_records cr
      where cr.id = consultations.clinical_record_id
        and cr.patient_id = cr.patient_id
        and cr.primary_therapist_id = auth.uid()
        and cr.organization_id = cr.organization_id
    )
  );

drop policy if exists consultations_update on public.consultations;
create policy consultations_update on public.consultations
  for update using (organization_id = auth_organization_id() and therapist_id = auth.uid());

drop policy if exists consultations_select on public.consultations;
create policy consultations_select on public.consultations
  for select using (
    organization_id = auth_organization_id()
    and (
      therapist_id = auth.uid()
      or (auth_role() = 'supervisor'::user_role and (auth_clinic_id() is null or clinic_id = auth_clinic_id()))
    )
  );

-- appointments
drop policy if exists appointments_update on public.appointments;
create policy appointments_update on public.appointments
  for update using (
    organization_id = auth_organization_id()
    and (
      (auth_role() = any (array['assistant','org_admin']::user_role[]) and (auth_clinic_id() is null or clinic_id = auth_clinic_id()))
      or (auth_role() = 'therapist'::user_role and therapist_id = auth.uid())
    )
  );

drop policy if exists appointments_insert on public.appointments;
create policy appointments_insert on public.appointments
  for insert with check (
    organization_id = auth_organization_id()
    and (
      (auth_role() = any (array['assistant','org_admin']::user_role[]) and (auth_clinic_id() is null or clinic_id = auth_clinic_id()))
      or (auth_role() = 'therapist'::user_role and therapist_id = auth.uid())
    )
  );

drop policy if exists appointments_select on public.appointments;
create policy appointments_select on public.appointments
  for select using (
    organization_id = auth_organization_id()
    and (
      (auth_role() = any (array['assistant','org_admin']::user_role[]) and (auth_clinic_id() is null or clinic_id = auth_clinic_id()))
      or therapist_id = auth.uid()
      or (auth_role() = 'supervisor'::user_role and (auth_clinic_id() is null or clinic_id = auth_clinic_id()))
    )
  );

-- consent_templates
drop policy if exists consent_templates_select on public.consent_templates;
create policy consent_templates_select on public.consent_templates
  for select using (organization_id = auth_organization_id());

drop policy if exists consent_templates_insert on public.consent_templates;
create policy consent_templates_insert on public.consent_templates
  for insert with check (organization_id = auth_organization_id() and is_org_admin_or_super());

drop policy if exists consent_templates_update on public.consent_templates;
create policy consent_templates_update on public.consent_templates
  for update using (organization_id = auth_organization_id() and is_org_admin_or_super());

-- consents
drop policy if exists consents_select on public.consents;
create policy consents_select on public.consents
  for select using (
    organization_id = auth_organization_id()
    and (auth_clinic_id() is null or clinic_id = auth_clinic_id())
  );

drop policy if exists consents_insert on public.consents;
create policy consents_insert on public.consents
  for insert with check (
    organization_id = auth_organization_id()
    and auth_role() = any (array['assistant','therapist','org_admin']::user_role[])
    and (auth_clinic_id() is null or clinic_id = auth_clinic_id())
  );

drop policy if exists consents_update on public.consents;
create policy consents_update on public.consents
  for update using (
    organization_id = auth_organization_id()
    and auth_role() = any (array['assistant','therapist','org_admin']::user_role[])
    and (auth_clinic_id() is null or clinic_id = auth_clinic_id())
  );

-- audit_logs
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select using (
    (organization_id = auth_organization_id() and is_org_admin_or_super()) or is_super_admin()
  );

-- ----------------------------------------------------------------------------
-- 9. Privilegios estándar de Supabase sobre el esquema public
-- ----------------------------------------------------------------------------
-- En un proyecto gestionado, la plataforma otorga estos GRANTs al aprovisionar
-- el proyecto (no viven en las migraciones del usuario, por lo que la
-- introspección de information_schema no los capturó como DDL propio). La
-- CLI local (`supabase db start`, usada en CI) NO los reproduce por sí sola,
-- así que sin esto cualquier tabla nueva queda sin privilegios a nivel SQL
-- para anon/authenticated/service_role — un error de "permission denied"
-- distinto y anterior a cualquier política RLS.
grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;

-- El GRANT ALL de arriba reabre update/delete sobre audit_logs para
-- authenticated/anon; se vuelve a revocar aquí (el REVOKE posterior es el
-- que queda vigente) para preservar la inmutabilidad exigida por el Caso 4
-- de la suite pgTAP.
revoke update, delete on public.audit_logs from authenticated, anon;
