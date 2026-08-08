-- Importación/exportación CSV, PDF e impresión de expedientes (ver
-- 20260808000000_import_export_print_audit.sql):
--   1. log_document_access valida action/table_name y deja el registro con
--      la organización del actor autenticado.
--   2. admin_read_clinical_record_full: solo org_admin, trae el expediente
--      completo (consultas/diagnósticos/recetas) de un paciente de su propia
--      organización, deja un evento de auditoría, y no filtra nada de otra
--      organización.

begin;
select plan(9);

select tests.authenticate_as_service_role();

insert into public.organizations (name, plan_id)
select 'Org Import Export - Test', id from public.plans where code = 'institucional';
select id as org_id from public.organizations where name = 'Org Import Export - Test' \gset
insert into public.clinics (organization_id, name) values (:'org_id', 'Clínica Import Export');
select id as clinic_id from public.clinics where organization_id = :'org_id' \gset

insert into public.organizations (name, plan_id)
select 'Org Import Export Otra - Test', id from public.plans where code = 'institucional';
select id as other_org_id from public.organizations where name = 'Org Import Export Otra - Test' \gset

select tests.create_supabase_user('ie_therapist', 'ie_therapist@test.com');
select tests.create_supabase_user('ie_psychiatrist', 'ie_psychiatrist@test.com');
select tests.create_supabase_user('ie_org_admin', 'ie_org_admin@test.com');

insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('ie_therapist'), :'org_id', :'clinic_id', 'therapist', 'Terapeuta IE', 'ie_therapist@test.com');
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('ie_psychiatrist'), :'org_id', :'clinic_id', 'psychiatrist', 'Psiquiatra IE', 'ie_psychiatrist@test.com');
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('ie_org_admin'), :'org_id', null, 'org_admin', 'Admin IE', 'ie_org_admin@test.com');

insert into public.patients (organization_id, clinic_id, full_name, date_of_birth, category, primary_therapist_id)
select :'org_id', :'clinic_id', 'Paciente IE', '1990-01-01', 'adult', tests.get_supabase_uid('ie_therapist');
select id as patient_id from public.patients where full_name = 'Paciente IE' \gset

insert into public.clinical_records (organization_id, clinic_id, patient_id, primary_therapist_id, chief_complaint)
values (:'org_id', :'clinic_id', :'patient_id', tests.get_supabase_uid('ie_therapist'), 'Motivo IE');
select id as record_id from public.clinical_records where patient_id = :'patient_id' \gset

insert into public.consultations (organization_id, clinic_id, patient_id, clinical_record_id, therapist_id, reason)
values (:'org_id', :'clinic_id', :'patient_id', :'record_id', tests.get_supabase_uid('ie_therapist'), 'Primera sesión IE');

-- ---------------------------------------------------------------
-- Caso 1: log_document_access rechaza una acción no permitida
-- ---------------------------------------------------------------
select tests.authenticate_as('ie_therapist');
select throws_ok(
  format($$ select public.log_document_access('patients', '%s', 'DELETE') $$, :'patient_id'),
  'P0001',
  null,
  'Caso 1: log_document_access rechaza acciones distintas de PRINT/EXPORT_PDF/EXPORT_CSV'
);

-- ---------------------------------------------------------------
-- Caso 2: log_document_access rechaza una tabla no permitida
-- ---------------------------------------------------------------
select throws_ok(
  format($$ select public.log_document_access('profiles', '%s', 'PRINT') $$, :'patient_id'),
  'P0001',
  null,
  'Caso 2: log_document_access rechaza tablas fuera de la lista permitida'
);

-- ---------------------------------------------------------------
-- Caso 3: log_document_access inserta el evento con la organización del actor
-- ---------------------------------------------------------------
select public.log_document_access('clinical_records', :'record_id', 'PRINT');

select tests.authenticate_as_service_role();
select is(
  (select count(*)::int from audit_logs
     where table_name = 'clinical_records'
       and record_id = :'record_id'
       and action = 'PRINT'
       and actor_id = tests.get_supabase_uid('ie_therapist')
       and organization_id = :'org_id'::uuid),
  1,
  'Caso 3: log_document_access deja el evento PRINT con actor y organización correctos'
);

-- ---------------------------------------------------------------
-- Caso 4: un therapist/psychiatrist normal no puede usar admin_read_clinical_record_full
-- ---------------------------------------------------------------
select tests.authenticate_as('ie_therapist');
select throws_ok(
  format($$ select public.admin_read_clinical_record_full('%s') $$, :'patient_id'),
  'P0001',
  'Solo org_admin puede usar esta función de acceso elevado',
  'Caso 4: admin_read_clinical_record_full rechaza a un usuario que no es org_admin'
);

-- ---------------------------------------------------------------
-- Caso 5: org_admin sí puede, y trae el expediente con sus consultas
-- ---------------------------------------------------------------
select tests.authenticate_as('ie_org_admin');
select ok(
  (select public.admin_read_clinical_record_full(:'patient_id')) is not null,
  'Caso 5: admin_read_clinical_record_full devuelve datos para org_admin de la misma organización'
);

select is(
  (select (public.admin_read_clinical_record_full(:'patient_id'))->'clinical_record'->>'id'),
  :'record_id'::text,
  'Caso 5b: el expediente devuelto corresponde al del paciente pedido'
);

select is(
  (select jsonb_array_length((public.admin_read_clinical_record_full(:'patient_id'))->'consultations')),
  1,
  'Caso 5c: incluye las consultas del expediente'
);

-- ---------------------------------------------------------------
-- Caso 6: cada llamada de org_admin deja su propio evento de auditoría
-- ---------------------------------------------------------------
select tests.authenticate_as_service_role();
select ok(
  (select count(*)::int from audit_logs
     where table_name = 'clinical_records'
       and record_id = :'record_id'
       and action = 'SELECT'
       and actor_id = tests.get_supabase_uid('ie_org_admin')) >= 1,
  'Caso 6: admin_read_clinical_record_full deja constancia en audit_logs (acceso elevado auditado)'
);

-- ---------------------------------------------------------------
-- Caso 7: un paciente que no existe (o de otra organización) devuelve null,
-- sin lanzar error ni filtrar nada.
-- ---------------------------------------------------------------
insert into public.clinics (organization_id, name) values (:'other_org_id', 'Clínica Otra IE');
select id as other_clinic_id from public.clinics where organization_id = :'other_org_id' \gset
insert into public.patients (organization_id, clinic_id, full_name, date_of_birth, category)
values (:'other_org_id', :'other_clinic_id', 'Paciente Otra Org IE', '1985-05-05', 'adult');
select id as other_patient_id from public.patients where full_name = 'Paciente Otra Org IE' \gset

select tests.authenticate_as('ie_org_admin');
select ok(
  (select public.admin_read_clinical_record_full(:'other_patient_id')) is null,
  'Caso 7: admin_read_clinical_record_full no filtra expedientes de otra organización'
);

select * from finish();
rollback;
