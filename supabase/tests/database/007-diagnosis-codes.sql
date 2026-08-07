-- Módulo de psiquiatría — Fase 4 (ver 20260807000002_diagnosis_codes.sql):
--   1. diagnosis_codes es un catálogo de lectura abierta a cualquier
--      autenticado, escritura solo para super_admin.
--   2. patient_diagnoses: solo un psychiatrist miembro activo del equipo de
--      atención puede diagnosticar (INSERT/UPDATE).
--   3. Lectura compartida entre miembros del equipo + supervisor a nivel de
--      clínica; quien no es miembro no ve nada.
--   4. admin_read_patient_diagnosis(): acceso elevado auditado, solo
--      org_admin.

begin;
select plan(12);

select tests.authenticate_as_service_role();

insert into public.organizations (name, plan_id)
select 'Org Diagnósticos - Test', id from public.plans where code = 'institucional';
select id as org_id from public.organizations where name = 'Org Diagnósticos - Test' \gset
insert into public.clinics (organization_id, name) values (:'org_id', 'Clínica Diagnósticos');
select id as clinic_id from public.clinics where organization_id = :'org_id' \gset

select tests.create_supabase_user('diag_therapist', 'diag_therapist@test.com');
select tests.create_supabase_user('diag_psychiatrist', 'diag_psychiatrist@test.com');
select tests.create_supabase_user('diag_outsider_psychiatrist', 'diag_outsider_psychiatrist@test.com');
select tests.create_supabase_user('diag_supervisor', 'diag_supervisor@test.com');
select tests.create_supabase_user('diag_org_admin', 'diag_org_admin@test.com');

insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('diag_therapist'), :'org_id', :'clinic_id', 'therapist', 'Terapeuta Diagnósticos', 'diag_therapist@test.com');
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('diag_psychiatrist'), :'org_id', :'clinic_id', 'psychiatrist', 'Psiquiatra Diagnósticos', 'diag_psychiatrist@test.com');
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('diag_outsider_psychiatrist'), :'org_id', :'clinic_id', 'psychiatrist', 'Psiquiatra Fuera del Equipo', 'diag_outsider_psychiatrist@test.com');
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('diag_supervisor'), :'org_id', :'clinic_id', 'supervisor', 'Supervisor Diagnósticos', 'diag_supervisor@test.com');
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('diag_org_admin'), :'org_id', null, 'org_admin', 'Admin Diagnósticos', 'diag_org_admin@test.com');

insert into public.patients (organization_id, clinic_id, full_name, date_of_birth, category, primary_therapist_id)
select :'org_id', :'clinic_id', 'Paciente Diagnósticos', '1985-05-05', 'adult', tests.get_supabase_uid('diag_therapist');
select id as patient_id from public.patients where full_name = 'Paciente Diagnósticos' \gset

insert into public.clinical_records (organization_id, clinic_id, patient_id, primary_therapist_id, chief_complaint)
values (:'org_id', :'clinic_id', :'patient_id', tests.get_supabase_uid('diag_therapist'), 'Motivo diagnósticos');
select id as record_id from public.clinical_records where patient_id = :'patient_id' \gset

-- El terapeuta agrega al psiquiatra al equipo (diag_outsider_psychiatrist
-- queda deliberadamente fuera).
select tests.authenticate_as('diag_therapist');
insert into public.clinical_record_team_members (clinical_record_id, clinician_id)
values (:'record_id', tests.get_supabase_uid('diag_psychiatrist'));

select tests.authenticate_as_service_role();

-- Código CIE-11 de referencia (normalmente vendría de la sincronización con
-- la API de la OMS; para el test se inserta directo).
insert into public.diagnosis_codes (code, title) values ('6A70', 'Trastorno depresivo de episodio único, actual episodio depresivo leve');
select id as code_id from public.diagnosis_codes where code = '6A70' \gset

-- ---------------------------------------------------------------
-- Caso 1: diagnosis_codes es legible por cualquier autenticado
-- ---------------------------------------------------------------
select tests.authenticate_as('diag_therapist');
select is(
  (select count(*)::int from public.diagnosis_codes where code = '6A70'),
  1,
  'Caso 1: cualquier usuario autenticado puede leer el catálogo diagnosis_codes'
);

-- ---------------------------------------------------------------
-- Caso 2: un no-super_admin no puede insertar en diagnosis_codes
-- ---------------------------------------------------------------
select throws_ok(
  $$ insert into public.diagnosis_codes (code, title) values ('6A71', 'Intento no autorizado') $$,
  '42501',
  null,
  'Caso 2: un usuario que no es super_admin no puede insertar en diagnosis_codes'
);

-- ---------------------------------------------------------------
-- Caso 3: un therapist (aunque sea miembro del equipo) no puede diagnosticar
-- ---------------------------------------------------------------
select throws_ok(
  format(
    $$ insert into public.patient_diagnoses
         (organization_id, clinic_id, patient_id, clinical_record_id, diagnosis_code_id, diagnosed_by)
       values ('%s','%s','%s','%s','%s','%s') $$,
    :'org_id', :'clinic_id', :'patient_id', :'record_id', :'code_id', tests.get_supabase_uid('diag_therapist')
  ),
  '42501',
  null,
  'Caso 3: un therapist miembro del equipo no puede insertar en patient_diagnoses (solo psychiatrist)'
);

-- ---------------------------------------------------------------
-- Caso 4: un psychiatrist que NO es miembro del equipo tampoco puede
-- ---------------------------------------------------------------
select tests.authenticate_as('diag_outsider_psychiatrist');
select throws_ok(
  format(
    $$ insert into public.patient_diagnoses
         (organization_id, clinic_id, patient_id, clinical_record_id, diagnosis_code_id, diagnosed_by)
       values ('%s','%s','%s','%s','%s','%s') $$,
    :'org_id', :'clinic_id', :'patient_id', :'record_id', :'code_id', tests.get_supabase_uid('diag_outsider_psychiatrist')
  ),
  '42501',
  null,
  'Caso 4: un psychiatrist que no es miembro del equipo de ese expediente no puede diagnosticar'
);

-- ---------------------------------------------------------------
-- Caso 5: el psychiatrist miembro del equipo SÍ puede diagnosticar
-- ---------------------------------------------------------------
select tests.authenticate_as('diag_psychiatrist');
insert into public.patient_diagnoses
  (organization_id, clinic_id, patient_id, clinical_record_id, diagnosis_code_id, diagnosed_by, type, notes)
values
  (:'org_id', :'clinic_id', :'patient_id', :'record_id', :'code_id', tests.get_supabase_uid('diag_psychiatrist'), 'principal', 'Primera evaluación');

select tests.authenticate_as_service_role();
select is(
  (select count(*)::int from public.patient_diagnoses where clinical_record_id = :'record_id'),
  1,
  'Caso 5: un psychiatrist miembro activo del equipo sí puede registrar un diagnóstico'
);
select id as diagnosis_id from public.patient_diagnoses where clinical_record_id = :'record_id' \gset

-- ---------------------------------------------------------------
-- Caso 6: el terapeuta (miembro del equipo) lee el diagnóstico
-- ---------------------------------------------------------------
select tests.authenticate_as('diag_therapist');
select is(
  (select count(*)::int from public.patient_diagnoses where id = :'diagnosis_id'),
  1,
  'Caso 6: un miembro del equipo que no es psychiatrist sí puede leer el diagnóstico (transparencia)'
);

-- ---------------------------------------------------------------
-- Caso 7: el psychiatrist fuera del equipo no ve el diagnóstico
-- ---------------------------------------------------------------
select tests.authenticate_as('diag_outsider_psychiatrist');
select is(
  (select count(*)::int from public.patient_diagnoses where id = :'diagnosis_id'),
  0,
  'Caso 7: un clínico que no es miembro del equipo no ve el diagnóstico'
);

-- ---------------------------------------------------------------
-- Caso 8: supervisor lee el diagnóstico a nivel de clínica
-- ---------------------------------------------------------------
select tests.authenticate_as('diag_supervisor');
select is(
  (select count(*)::int from public.patient_diagnoses where id = :'diagnosis_id'),
  1,
  'Caso 8: supervisor lee el diagnóstico sin ser miembro del equipo'
);

-- ---------------------------------------------------------------
-- Caso 9: org_admin NO tiene lectura directa (debe usar la función auditada)
-- ---------------------------------------------------------------
select tests.authenticate_as('diag_org_admin');
select is(
  (select count(*)::int from public.patient_diagnoses where id = :'diagnosis_id'),
  0,
  'Caso 9: org_admin no tiene policy de SELECT directa sobre patient_diagnoses'
);

-- ---------------------------------------------------------------
-- Caso 10: admin_read_patient_diagnosis() sí funciona para org_admin y audita
-- ---------------------------------------------------------------
select is(
  (select (admin_read_patient_diagnosis(:'diagnosis_id')).id),
  :'diagnosis_id'::uuid,
  'Caso 10: org_admin puede leer el diagnóstico vía la función de acceso elevado'
);

select tests.authenticate_as_service_role();
select is(
  (select count(*)::int from public.audit_logs
     where table_name = 'patient_diagnoses' and record_id = :'diagnosis_id'::uuid and action = 'SELECT'),
  1,
  'Caso 10b: el acceso de org_admin vía admin_read_patient_diagnosis() quedó registrado en audit_logs'
);

-- ---------------------------------------------------------------
-- Caso 11: un therapist no puede usar la función de acceso elevado
-- ---------------------------------------------------------------
select tests.authenticate_as('diag_therapist');
select throws_ok(
  format('select admin_read_patient_diagnosis(%L)', :'diagnosis_id'),
  'P0001',
  'Solo org_admin puede usar esta función de acceso elevado',
  'Caso 11: un therapist no puede usar admin_read_patient_diagnosis()'
);

select * from finish();
rollback;
