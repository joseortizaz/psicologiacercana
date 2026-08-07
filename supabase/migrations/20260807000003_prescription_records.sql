-- ============================================================================
-- Módulo de psiquiatría — Fase 5: registro histórico interno de recetas
-- (ver plan-modulo-psiquiatria-cercana.md, secciones 2.4, 3.3 y 5).
-- ============================================================================
-- IMPORTANTE (decisión de producto, sección 0.1 y "fuera de alcance" del
-- plan): esto NO es una receta electrónica con validez legal. El médico
-- sigue emitiendo la receta física de siempre — esto es únicamente un
-- registro/histórico interno de lo que recetó, consultable desde el Portal.
-- No se genera PDF ni ningún documento que pueda confundirse con una receta
-- legal. `medication_name`/`dosage`/`frequency`/`duration`/`instructions`
-- son texto libre, sin catálogo de medicamentos estructurado (decisión 4).
-- ============================================================================

create table if not exists public.prescription_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  clinic_id uuid not null references public.clinics(id),
  patient_id uuid not null references public.patients(id),
  clinical_record_id uuid not null references public.clinical_records(id),
  prescribing_clinician_id uuid not null references public.profiles(id),
  issued_at date not null default current_date,
  diagnosis_id uuid references public.patient_diagnoses(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_prescription_records_org on public.prescription_records using btree (organization_id);
create index if not exists idx_prescription_records_clinic on public.prescription_records using btree (clinic_id);
create index if not exists idx_prescription_records_patient on public.prescription_records using btree (patient_id);
create index if not exists idx_prescription_records_clinical_record on public.prescription_records using btree (clinical_record_id);
create index if not exists idx_prescription_records_clinician on public.prescription_records using btree (prescribing_clinician_id);
create index if not exists idx_prescription_records_issued_at on public.prescription_records using btree (organization_id, issued_at desc);

drop trigger if exists trg_prescription_records_updated_at on public.prescription_records;
create trigger trg_prescription_records_updated_at before update on public.prescription_records
  for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_prescription_records on public.prescription_records;
create trigger trg_audit_prescription_records after insert or update or delete on public.prescription_records
  for each row execute function public.log_audit_event();

alter table public.prescription_records enable row level security;

drop policy if exists prescription_records_select on public.prescription_records;
create policy prescription_records_select on public.prescription_records
  for select using (
    organization_id = auth_organization_id()
    and (
      is_care_team_member(clinical_record_id)
      or (auth_role() = 'supervisor'::user_role and (auth_clinic_id() is null or clinic_id = auth_clinic_id()))
    )
  );

drop policy if exists prescription_records_insert on public.prescription_records;
create policy prescription_records_insert on public.prescription_records
  for insert with check (
    organization_id = auth_organization_id()
    and auth_role() = 'psychiatrist'::user_role
    and prescribing_clinician_id = auth.uid()
    and is_care_team_member(clinical_record_id)
    and exists (
      select 1 from clinical_records cr
      where cr.id = prescription_records.clinical_record_id
        and cr.patient_id = prescription_records.patient_id
        and cr.organization_id = prescription_records.organization_id
        and cr.clinic_id = prescription_records.clinic_id
    )
  );

drop policy if exists prescription_records_update on public.prescription_records;
create policy prescription_records_update on public.prescription_records
  for update using (
    organization_id = auth_organization_id()
    and auth_role() = 'psychiatrist'::user_role
    and is_care_team_member(clinical_record_id)
  );

-- Sin policy de DELETE — es un histórico, no se borra.

create or replace function public.admin_read_prescription_record(p_prescription_record_id uuid)
returns prescription_records
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_record prescription_records;
begin
  if auth_role() <> 'org_admin' then
    raise exception 'Solo org_admin puede usar esta función de acceso elevado';
  end if;

  select * into v_record
  from prescription_records
  where id = p_prescription_record_id
    and organization_id = auth_organization_id();

  if not found then
    raise exception 'Registro de receta no encontrado o fuera de tu organización';
  end if;

  insert into audit_logs (actor_id, organization_id, table_name, record_id, action)
  values (auth.uid(), v_record.organization_id, 'prescription_records', v_record.id, 'SELECT');

  return v_record;
end;
$$;

-- ----------------------------------------------------------------------------
-- prescription_items
-- ----------------------------------------------------------------------------
-- organization_id/clinic_id/clinical_record_id se guardan denormalizados
-- (igual patrón que consultations respecto a clinical_records) para que las
-- policies de esta tabla no dependan de un JOIN contra prescription_records
-- en cada evaluación de RLS. Se autocompletan desde prescription_records si
-- el insertador no los provee (mismo patrón que
-- clinical_record_team_members, ver fill_team_member_defaults()).
create table if not exists public.prescription_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  clinic_id uuid not null references public.clinics(id),
  clinical_record_id uuid not null references public.clinical_records(id),
  prescription_record_id uuid not null references public.prescription_records(id),
  medication_name text not null,
  dosage text not null,
  frequency text not null,
  duration text,
  instructions text,
  is_controlled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_prescription_items_record on public.prescription_items using btree (prescription_record_id);
create index if not exists idx_prescription_items_org on public.prescription_items using btree (organization_id);
create index if not exists idx_prescription_items_clinical_record on public.prescription_items using btree (clinical_record_id);
create index if not exists idx_prescription_items_controlled on public.prescription_items using btree (organization_id, is_controlled);

create or replace function public.fill_prescription_item_defaults()
returns trigger
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_pr prescription_records;
begin
  if NEW.organization_id is null or NEW.clinic_id is null or NEW.clinical_record_id is null then
    select * into v_pr from public.prescription_records where id = NEW.prescription_record_id;
    NEW.organization_id := coalesce(NEW.organization_id, v_pr.organization_id);
    NEW.clinic_id := coalesce(NEW.clinic_id, v_pr.clinic_id);
    NEW.clinical_record_id := coalesce(NEW.clinical_record_id, v_pr.clinical_record_id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_prescription_items_fill_defaults on public.prescription_items;
create trigger trg_prescription_items_fill_defaults
  before insert on public.prescription_items
  for each row execute function public.fill_prescription_item_defaults();

drop trigger if exists trg_prescription_items_updated_at on public.prescription_items;
create trigger trg_prescription_items_updated_at before update on public.prescription_items
  for each row execute function public.set_updated_at();
drop trigger if exists trg_audit_prescription_items on public.prescription_items;
create trigger trg_audit_prescription_items after insert or update or delete on public.prescription_items
  for each row execute function public.log_audit_event();

alter table public.prescription_items enable row level security;

drop policy if exists prescription_items_select on public.prescription_items;
create policy prescription_items_select on public.prescription_items
  for select using (
    organization_id = auth_organization_id()
    and (
      is_care_team_member(clinical_record_id)
      or (auth_role() = 'supervisor'::user_role and (auth_clinic_id() is null or clinic_id = auth_clinic_id()))
    )
  );

drop policy if exists prescription_items_insert on public.prescription_items;
create policy prescription_items_insert on public.prescription_items
  for insert with check (
    organization_id = auth_organization_id()
    and auth_role() = 'psychiatrist'::user_role
    and is_care_team_member(clinical_record_id)
    and exists (
      select 1 from prescription_records pr
      where pr.id = prescription_items.prescription_record_id
        and pr.organization_id = prescription_items.organization_id
        and pr.clinic_id = prescription_items.clinic_id
        and pr.clinical_record_id = prescription_items.clinical_record_id
        and pr.prescribing_clinician_id = auth.uid()
    )
  );

drop policy if exists prescription_items_update on public.prescription_items;
create policy prescription_items_update on public.prescription_items
  for update using (
    organization_id = auth_organization_id()
    and auth_role() = 'psychiatrist'::user_role
    and is_care_team_member(clinical_record_id)
  );

-- Sin policy de DELETE — es un histórico, no se borra.
