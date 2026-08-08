-- ============================================================================
-- Registro de Evaluaciones (evaluation_reports) — módulo pendiente de la
-- Fase 3 original (ver plan-implementacion-registro-evaluaciones.md).
-- ============================================================================
-- DECISIÓN DE PRODUCTO (no reabrir): solo se registran informes y resultados
-- de evaluaciones ya aplicadas por el propio clínico fuera de la app. Nunca
-- se digitaliza el instrumento en sí (reactivos, ítems, baremos, algoritmos
-- de corrección de WISC-V, WAIS, MMPI, BDI, etc. — son propiedad de sus
-- editoriales). test_name es texto libre, sin catálogo cerrado — el nombre
-- de una prueba no es contenido protegido, solo sus reactivos/criterios.
-- interpretation debe ser redacción propia del clínico, nunca texto copiado
-- del manual.
--
-- Solo `therapist` puede crear y editar evaluaciones. `psychiatrist` es
-- miembro del equipo de atención (clinical_record_team_members, ya
-- implementado en el módulo de psiquiatría) y por lo tanto tiene lectura,
-- pero no puede registrar evaluaciones propias — decisión de negocio
-- confirmada: la evaluación psicométrica es exclusiva del psicólogo
-- tratante.
--
-- Primera tabla del proyecto que necesita Supabase Storage con acceso
-- directo desde el cliente (el bucket 'signup-documents' existente solo se
-- toca desde edge functions con service_role). Las policies de
-- storage.objects (sección "Storage" más abajo) replican la misma lógica de
-- tenant/equipo de atención que la tabla, usando la ruta del objeto
-- ({organization_id}/{clinical_record_id}/{archivo}) como límite de acceso.
-- ============================================================================

do $$ begin
  create type public.evaluation_status as enum ('draft', 'finalized');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- evaluation_reports
-- ----------------------------------------------------------------------------
create table if not exists public.evaluation_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  clinic_id uuid not null references public.clinics(id),
  patient_id uuid not null references public.patients(id),
  clinical_record_id uuid not null references public.clinical_records(id),
  administered_by uuid not null references public.profiles(id),
  -- Opcional: la evaluación puede haberse aplicado para apoyar/confirmar un
  -- diagnóstico ya registrado en patient_diagnoses.
  diagnosis_id uuid references public.patient_diagnoses(id),
  -- Texto libre, sin catálogo cerrado (ver cabecera del archivo).
  test_name text not null,
  administered_at date not null default current_date,
  score_summary text,
  -- Redacción propia del clínico -- nunca texto copiado del manual de la
  -- prueba (ver cabecera del archivo).
  interpretation text,
  -- Ruta dentro del bucket privado 'evaluation-reports'
  -- ({organization_id}/{clinical_record_id}/{archivo}), no una URL pública
  -- -- mismo criterio de nombre que signup_requests.*_document_path.
  attachment_path text,
  status public.evaluation_status not null default 'draft',
  finalized_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evaluation_reports_test_name_not_blank check (btrim(test_name) <> '')
);

create index if not exists idx_evaluation_reports_org on public.evaluation_reports using btree (organization_id);
create index if not exists idx_evaluation_reports_clinic on public.evaluation_reports using btree (clinic_id);
create index if not exists idx_evaluation_reports_patient on public.evaluation_reports using btree (patient_id);
create index if not exists idx_evaluation_reports_clinical_record on public.evaluation_reports using btree (clinical_record_id);
create index if not exists idx_evaluation_reports_administered_by on public.evaluation_reports using btree (administered_by);
create index if not exists idx_evaluation_reports_diagnosis on public.evaluation_reports using btree (diagnosis_id);
create index if not exists idx_evaluation_reports_status on public.evaluation_reports using btree (organization_id, status);

drop trigger if exists trg_evaluation_reports_updated_at on public.evaluation_reports;
create trigger trg_evaluation_reports_updated_at before update on public.evaluation_reports
  for each row execute function public.set_updated_at();

drop trigger if exists trg_audit_evaluation_reports on public.evaluation_reports;
create trigger trg_audit_evaluation_reports after insert or update or delete on public.evaluation_reports
  for each row execute function public.log_audit_event();

-- Mismo patrón que prevent_finalized_consultation_edit(): una vez
-- finalizado, el informe queda inmutable. El frontend registra una nueva
-- evaluación de seguimiento en su lugar.
create or replace function public.prevent_finalized_evaluation_edit()
returns trigger
language plpgsql
as $$
begin
  if OLD.status = 'finalized' then
    raise exception 'No se puede modificar una evaluación ya finalizada (id: %). Registre una nueva evaluación de seguimiento en su lugar.', OLD.id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_evaluation_reports_prevent_finalized_edit on public.evaluation_reports;
create trigger trg_evaluation_reports_prevent_finalized_edit
  before update on public.evaluation_reports
  for each row execute function public.prevent_finalized_evaluation_edit();

alter table public.evaluation_reports enable row level security;

-- SELECT: cualquier miembro activo del equipo de atención del
-- clinical_record correspondiente (incluye psychiatrist, que solo lee) +
-- supervisor a nivel de clínica. org_admin NO tiene policy de SELECT
-- directa -- accede vía admin_read_evaluation_report() (auditada), mismo
-- patrón que clinical_records/consultations/patient_diagnoses/
-- prescription_records.
drop policy if exists evaluation_reports_select on public.evaluation_reports;
create policy evaluation_reports_select on public.evaluation_reports
  for select using (
    organization_id = auth_organization_id()
    and (
      is_care_team_member(clinical_record_id)
      or (auth_role() = 'supervisor'::user_role and (auth_clinic_id() is null or clinic_id = auth_clinic_id()))
    )
  );

-- INSERT: solo therapist, miembro activo del equipo de ese clinical_record,
-- y solo puede registrarse a sí mismo como administered_by -- psychiatrist
-- NO puede crear evaluaciones (decisión de negocio confirmada en el plan).
drop policy if exists evaluation_reports_insert on public.evaluation_reports;
create policy evaluation_reports_insert on public.evaluation_reports
  for insert with check (
    organization_id = auth_organization_id()
    and auth_role() = 'therapist'::user_role
    and administered_by = auth.uid()
    and is_care_team_member(clinical_record_id)
    and exists (
      select 1 from clinical_records cr
      where cr.id = evaluation_reports.clinical_record_id
        and cr.patient_id = evaluation_reports.patient_id
        and cr.organization_id = evaluation_reports.organization_id
        and cr.clinic_id = evaluation_reports.clinic_id
    )
  );

-- UPDATE: solo el propio autor (administered_by = auth.uid()) -- a
-- diferencia de patient_diagnoses/prescription_records (donde cualquier
-- psychiatrist del equipo puede editar cualquier registro del equipo), acá
-- la escritura se restringe al autor individual, igual que consultations
-- ("la escritura se mantiene restringida solo al autor de cada nota"). El
-- bloqueo de edición tras finalizar lo maneja el trigger de arriba, no esta
-- policy.
drop policy if exists evaluation_reports_update on public.evaluation_reports;
create policy evaluation_reports_update on public.evaluation_reports
  for update using (
    organization_id = auth_organization_id()
    and auth_role() = 'therapist'::user_role
    and administered_by = auth.uid()
    and is_care_team_member(clinical_record_id)
  );

-- Sin policy de DELETE -- nunca se borra, ni siquiera el autor (ver plan,
-- sección 3). El ciclo de vida se maneja con `status`.

-- Acceso elevado y auditado para org_admin (mismo patrón que
-- admin_read_clinical_record / admin_read_prescription_record).
create or replace function public.admin_read_evaluation_report(p_evaluation_report_id uuid)
returns evaluation_reports
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_record evaluation_reports;
begin
  if auth_role() <> 'org_admin' then
    raise exception 'Solo org_admin puede usar esta función de acceso elevado';
  end if;

  select * into v_record
  from evaluation_reports
  where id = p_evaluation_report_id
    and organization_id = auth_organization_id();

  if not found then
    raise exception 'Evaluación no encontrada o fuera de tu organización';
  end if;

  insert into audit_logs (actor_id, organization_id, table_name, record_id, action)
  values (auth.uid(), v_record.organization_id, 'evaluation_reports', v_record.id, 'SELECT');

  return v_record;
end;
$$;

-- ============================================================================
-- Storage: bucket privado para el PDF opcional del informe de evaluación.
-- ============================================================================
-- Primera vez que el esquema necesita acceso DIRECTO desde el cliente a
-- Storage (el bucket 'signup-documents' solo se toca vía edge functions con
-- service_role). Convención de ruta del objeto:
--
--   {organization_id}/{clinical_record_id}/{archivo}
--
-- Las policies de storage.objects usan (storage.foldername(name))[1] para
-- el organization_id y (storage.foldername(name))[2] para el
-- clinical_record_id, replicando exactamente el mismo chequeo de tenant/
-- equipo de atención que la tabla evaluation_reports:
--   - SELECT: miembro activo del equipo (is_care_team_member) + supervisor
--     de la clínica del clinical_record. org_admin, igual que con la fila
--     de la tabla, NO tiene policy directa aquí -- su acceso al PDF debe
--     resolverse con un signed URL generado por una edge function
--     (service_role) que primero llame a admin_read_evaluation_report()
--     para auditar el acceso, mismo patrón que get-signup-document-urls.
--     Pendiente de construir en la fase de frontend, no bloquea este
--     esquema.
--   - INSERT/UPDATE: solo therapist miembro activo del equipo (coincide con
--     evaluation_reports_insert/_update). Sin policy de DELETE -- igual que
--     la fila, el archivo tampoco se borra una vez subido.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evaluation-reports',
  'evaluation-reports',
  false,
  15728640, -- 15 MiB por archivo
  array['application/pdf']
)
on conflict (id) do nothing;

drop policy if exists evaluation_reports_storage_select on storage.objects;
create policy evaluation_reports_storage_select on storage.objects
  for select using (
    bucket_id = 'evaluation-reports'
    and (storage.foldername(name))[1] = auth_organization_id()::text
    and (
      is_care_team_member(((storage.foldername(name))[2])::uuid)
      or (
        auth_role() = 'supervisor'::user_role
        and exists (
          select 1 from clinical_records cr
          where cr.id = ((storage.foldername(name))[2])::uuid
            and cr.organization_id = auth_organization_id()
            and (auth_clinic_id() is null or cr.clinic_id = auth_clinic_id())
        )
      )
    )
  );

drop policy if exists evaluation_reports_storage_insert on storage.objects;
create policy evaluation_reports_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'evaluation-reports'
    and (storage.foldername(name))[1] = auth_organization_id()::text
    and auth_role() = 'therapist'::user_role
    and is_care_team_member(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists evaluation_reports_storage_update on storage.objects;
create policy evaluation_reports_storage_update on storage.objects
  for update using (
    bucket_id = 'evaluation-reports'
    and (storage.foldername(name))[1] = auth_organization_id()::text
    and auth_role() = 'therapist'::user_role
    and is_care_team_member(((storage.foldername(name))[2])::uuid)
  );

-- Sin policy de DELETE en storage.objects -- igual que la fila de la tabla,
-- el archivo no se borra una vez subido.
