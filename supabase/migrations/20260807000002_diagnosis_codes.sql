-- ============================================================================
-- Módulo de psiquiatría — Fase 4: catálogo CIE-11 + patient_diagnoses
-- (ver plan-modulo-psiquiatria-cercana.md, secciones 2.3 y 3.3).
-- ============================================================================
-- Nota sobre la ingesta CIE-11: este archivo solo crea el esquema. La
-- sincronización contra la API pública de la OMS (ICD-API) se resuelve por
-- separado (Edge Function `sync-icd11-diagnoses`, pendiente de credenciales
-- de la OMS) — el catálogo puede poblarse manualmente o vía esa función una
-- vez creada; el esquema no depende de eso.
-- ============================================================================

do $$ begin
  create type public.diagnosis_type as enum ('principal','secundario');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.diagnosis_status as enum ('activo','en_remisión','descartado');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- diagnosis_codes — catálogo global (no está aislado por organización; es un
-- catálogo de referencia compartido, igual que `plans`).
-- ----------------------------------------------------------------------------
create extension if not exists pg_trgm;

create table if not exists public.diagnosis_codes (
  id uuid primary key default gen_random_uuid(),
  system text not null default 'icd11',
  code text not null,
  title text not null,
  parent_code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (system, code)
);

-- Nota: parent_code se guarda como texto plano, sin FK hacia el propio code
-- de esta tabla a propósito — la ingesta masiva de un árbol jerárquico no
-- garantiza que el padre ya exista en el momento de insertar un hijo, y
-- forzar el orden exacto de inserción es más frágil que simplemente no
-- validarlo a nivel de esquema (la UI puede resolverlo igual, uniendo por
-- code cuando lo necesite).

create index if not exists idx_diagnosis_codes_system_active
  on public.diagnosis_codes using btree (system, active);
create index if not exists idx_diagnosis_codes_parent
  on public.diagnosis_codes using btree (parent_code);
create index if not exists idx_diagnosis_codes_title_trgm
  on public.diagnosis_codes using gin (title gin_trgm_ops);

drop trigger if exists trg_diagnosis_codes_updated_at on public.diagnosis_codes;
create trigger trg_diagnosis_codes_updated_at before update on public.diagnosis_codes
  for each row execute function public.set_updated_at();

alter table public.diagnosis_codes enable row level security;

-- Catálogo de solo lectura para cualquier usuario autenticado (igual patrón
-- que `plans`); solo super_admin (o la Edge Function de sincronización, que
-- corre como service_role y por lo tanto no pasa por RLS) puede escribir.
drop policy if exists diagnosis_codes_select on public.diagnosis_codes;
create policy diagnosis_codes_select on public.diagnosis_codes
  for select using (auth.uid() is not null);

drop policy if exists diagnosis_codes_insert on public.diagnosis_codes;
create policy diagnosis_codes_insert on public.diagnosis_codes
  for insert with check (is_super_admin());

drop policy if exists diagnosis_codes_update on public.diagnosis_codes;
create policy diagnosis_codes_update on public.diagnosis_codes
  for update using (is_super_admin());

-- ----------------------------------------------------------------------------
-- patient_diagnoses
-- ----------------------------------------------------------------------------
create table if not exists public.patient_diagnoses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  clinic_id uuid not null references public.clinics(id),
  patient_id uuid not null references public.patients(id),
  clinical_record_id uuid not null references public.clinical_records(id),
  diagnosis_code_id uuid not null references public.diagnosis_codes(id),
  type public.diagnosis_type not null default 'principal',
  status public.diagnosis_status not null default 'activo',
  diagnosed_by uuid references public.profiles(id),
  diagnosed_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_patient_diagnoses_org on public.patient_diagnoses using btree (organization_id);
create index if not exists idx_patient_diagnoses_clinic on public.patient_diagnoses using btree (clinic_id);
create index if not exists idx_patient_diagnoses_patient on public.patient_diagnoses using btree (patient_id);
create index if not exists idx_patient_diagnoses_record on public.patient_diagnoses using btree (clinical_record_id);
create index if not exists idx_patient_diagnoses_code on public.patient_diagnoses using btree (diagnosis_code_id);
create index if not exists idx_patient_diagnoses_status on public.patient_diagnoses using btree (organization_id, status);

drop trigger if exists trg_patient_diagnoses_updated_at on public.patient_diagnoses;
create trigger trg_patient_diagnoses_updated_at before update on public.patient_diagnoses
  for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_patient_diagnoses on public.patient_diagnoses;
create trigger trg_audit_patient_diagnoses after insert or update or delete on public.patient_diagnoses
  for each row execute function public.log_audit_event();

alter table public.patient_diagnoses enable row level security;

-- SELECT: cualquier miembro activo del equipo de atención del clinical_record
-- correspondiente, o supervisor a nivel de clínica (sección 3.3 del plan).
-- org_admin NO tiene policy de SELECT directa (mismo patrón que
-- clinical_records/consultations): accede vía admin_read_patient_diagnosis(),
-- que audita el acceso.
drop policy if exists patient_diagnoses_select on public.patient_diagnoses;
create policy patient_diagnoses_select on public.patient_diagnoses
  for select using (
    organization_id = auth_organization_id()
    and (
      is_care_team_member(clinical_record_id)
      or (auth_role() = 'supervisor'::user_role and (auth_clinic_id() is null or clinic_id = auth_clinic_id()))
    )
  );

-- INSERT/UPDATE: solo psychiatrist, y solo si es miembro activo del equipo
-- de ese clinical_record — un therapist no diagnostica (sección 3.3).
drop policy if exists patient_diagnoses_insert on public.patient_diagnoses;
create policy patient_diagnoses_insert on public.patient_diagnoses
  for insert with check (
    organization_id = auth_organization_id()
    and auth_role() = 'psychiatrist'::user_role
    and diagnosed_by = auth.uid()
    and is_care_team_member(clinical_record_id)
    and exists (
      select 1 from clinical_records cr
      where cr.id = patient_diagnoses.clinical_record_id
        and cr.patient_id = patient_diagnoses.patient_id
        and cr.organization_id = patient_diagnoses.organization_id
        and cr.clinic_id = patient_diagnoses.clinic_id
    )
  );

drop policy if exists patient_diagnoses_update on public.patient_diagnoses;
create policy patient_diagnoses_update on public.patient_diagnoses
  for update using (
    organization_id = auth_organization_id()
    and auth_role() = 'psychiatrist'::user_role
    and is_care_team_member(clinical_record_id)
  );

-- Sin policy de DELETE — el historial no se borra, se maneja con `status`
-- (mismo patrón que el resto de tablas clínicas).

-- Acceso elevado y auditado para org_admin (mismo patrón que
-- admin_read_clinical_record / admin_read_consultation).
create or replace function public.admin_read_patient_diagnosis(p_patient_diagnosis_id uuid)
returns patient_diagnoses
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_record patient_diagnoses;
begin
  if auth_role() <> 'org_admin' then
    raise exception 'Solo org_admin puede usar esta función de acceso elevado';
  end if;

  select * into v_record
  from patient_diagnoses
  where id = p_patient_diagnosis_id
    and organization_id = auth_organization_id();

  if not found then
    raise exception 'Diagnóstico no encontrado o fuera de tu organización';
  end if;

  insert into audit_logs (actor_id, organization_id, table_name, record_id, action)
  values (auth.uid(), v_record.organization_id, 'patient_diagnoses', v_record.id, 'SELECT');

  return v_record;
end;
$$;
