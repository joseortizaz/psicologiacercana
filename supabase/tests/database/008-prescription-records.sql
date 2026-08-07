-- Módulo de psiquiatría — Fase 5 (ver 20260807000003_prescription_records.sql):
--   1. Solo un psychiatrist miembro activo del equipo puede crear un
--      prescription_record y sus prescription_items.
--   2. Lectura compartida entre miembros del equipo + supervisor a nivel de
--      clínica; quien no es miembro no ve nada.
--   3. org_admin no tiene lectura directa, solo vía
--      admin_read_prescription_record() (auditada).

begin;
select plan(11);

select tests.authenticate_as_service_role();

insert into public.organizations (name, plan_id)
select 'Org Recetas - Test', id from public.plans where code = 'institucional';
select id as org_id from public.organizations where name = 'Org Recetas - Test' \gset
insert into public.clinics (organization_id, name) values (:'org_id', 'Clínica Recetas');
select id as clinic_id from public.clinics where organization_id = :'org_id' \gset

select tests.create_supabase_user('rx_therapist', 'rx_therapist@test.com');
select tests.create_supabase_user('rx_psychiatrist', 'rx_psychiatrist@test.com');
select tests.create_supabase_user('rx_outsider', 'rx_outsider@test.com');
select tests.create_supabase_user('rx_supervisor', 'rx_supervisor@test.com');
select tests.create_supabase_user('rx_org_admin', 'rx_org_admin@test.com');

insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('rx_therapist'), :'org_id', :'clinic_id', 'therapist', 'Terapeuta Recetas', 'rx_therapist@test.com');
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('rx_psychiatrist'), :'org_id', :'clinic_id', 'psychiatrist', 'Psiquiatra Recetas', 'rx_psychiatrist@test.com');
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('rx_outsider'), :'org_id', :'clinic_id', 'psychiatrist', 'Psiquiatra Fuera del Equipo', 'rx_outsider@test.com');
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('rx_supervisor'), :'org_id', :'clinic_id', 'supervisor', 'Supervisor Recetas', 'rx_supervisor@test.com');
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('rx_org_admin'), :'org_id', null, 'org_admin', 'Admin Recetas', 'rx_org_admin@test.com');

insert into public.patients (organization_id, clinic_id, full_name, date_of_birth, category, primary_therapist_id)
select :'org_id', :'clinic_id', 'Paciente Recetas', '1980-03-03', 'adult', tests.get_supabase_uid('rx_therapist');
select id as patient_id from public.patients where full_name = 'Paciente Recetas' \gset

insert into public.clinical_records (organization_id, clinic_id, patient_id, primary_therapist_id, chief_complaint)
values (:'org_id', :'clinic_id', :'patient_id', tests.get_supabase_uid('rx_therapist'), 'Motivo recetas');
select id as record_id from public.clinical_records where patient_id = :'patient_id' \gset

select tests.authenticate_as('rx_therapist');
insert into public.clinical_record_team_members (clinical_record_id, clinician_id)
values (:'record_id', tests.get_supabase_uid('rx_psychiatrist'));

-- ---------------------------------------------------------------
-- Caso 1: un therapist (miembro del equipo) no puede crear un prescription_record
-- ---------------------------------------------------------------
select throws_ok(
  format(
    $$ insert into public.prescription_records
         (organization_id, clinic_id, patient_id, clinical_record_id, prescribing_clinician_id)
       values ('%s','%s','%s','%s','%s') $$,
    :'org_id', :'clinic_id', :'patient_id', :'record_id', tests.get_supabase_uid('rx_therapist')
  ),
  '42501',
  null,
  'Caso 1: un therapist miembro del equipo no puede crear un registro de receta (solo psychiatrist)'
);

-- ---------------------------------------------------------------
-- Caso 2: un psychiatrist que NO es miembro del equipo tampoco puede
-- ---------------------------------------------------------------
select tests.authenticate_as('rx_outsider');
select throws_ok(
  format(
    $$ insert into public.prescription_records
         (organization_id, clinic_id, patient_id, clinical_record_id, prescribing_clinician_id)
       values ('%s','%s','%s','%s','%s') $$,
    :'org_id', :'clinic_id', :'patient_id', :'record_id', tests.get_supabase_uid('rx_outsider')
  ),
  '42501',
  null,
  'Caso 2: un psychiatrist que no es miembro del equipo no puede crear un registro de receta'
);

-- ---------------------------------------------------------------
-- Caso 3: el psychiatrist miembro del equipo SÍ puede crear el registro
-- ---------------------------------------------------------------
select tests.authenticate_as('rx_psychiatrist');
insert into public.prescription_records
  (organization_id, clinic_id, patient_id, clinical_record_id, prescribing_clinician_id, notes)
values
  (:'org_id', :'clinic_id', :'patient_id', :'record_id', tests.get_supabase_uid('rx_psychiatrist'), 'Receta física entregada en consulta');

select tests.authenticate_as_service_role();
select is(
  (select count(*)::int from public.prescription_records where clinical_record_id = :'record_id'),
  1,
  'Caso 3: un psychiatrist miembro activo del equipo sí puede crear un registro de receta'
);
select id as rx_id from public.prescription_records where clinical_record_id = :'record_id' \gset

-- ---------------------------------------------------------------
-- Caso 4: el mismo psychiatrist agrega los ítems de la receta
-- ---------------------------------------------------------------
select tests.authenticate_as('rx_psychiatrist');
insert into public.prescription_items
  (prescription_record_id, medication_name, dosage, frequency, is_controlled)
values
  (:'rx_id', 'Sertralina', '50 mg', 'Cada 24 horas', false),
  (:'rx_id', 'Clonazepam', '0.5 mg', 'Cada 12 horas', true);

select tests.authenticate_as_service_role();
select is(
  (select count(*)::int from public.prescription_items where prescription_record_id = :'rx_id'),
  2,
  'Caso 4: el psychiatrist puede registrar los ítems (medicamentos) de la receta'
);

select is(
  (select count(*)::int from public.prescription_items where prescription_record_id = :'rx_id' and is_controlled),
  1,
  'Caso 4b: is_controlled se guarda correctamente para diferenciar controlados en el histórico'
);

-- ---------------------------------------------------------------
-- Caso 5: el terapeuta (miembro del equipo) lee el registro y sus ítems
-- ---------------------------------------------------------------
select tests.authenticate_as('rx_therapist');
select is(
  (select count(*)::int from public.prescription_records where id = :'rx_id'),
  1,
  'Caso 5: un miembro del equipo que no es psychiatrist sí puede leer el registro de receta'
);
select is(
  (select count(*)::int from public.prescription_items where prescription_record_id = :'rx_id'),
  2,
  'Caso 5b: un miembro del equipo que no es psychiatrist sí puede leer los ítems de la receta'
);

-- ---------------------------------------------------------------
-- Caso 6: quien no es miembro del equipo no ve nada
-- ---------------------------------------------------------------
select tests.authenticate_as('rx_outsider');
select is(
  (select count(*)::int from public.prescription_records where id = :'rx_id'),
  0,
  'Caso 6: un clínico que no es miembro del equipo no ve el registro de receta'
);

-- ---------------------------------------------------------------
-- Caso 7: supervisor lee el registro a nivel de clínica
-- ---------------------------------------------------------------
select tests.authenticate_as('rx_supervisor');
select is(
  (select count(*)::int from public.prescription_records where id = :'rx_id'),
  1,
  'Caso 7: supervisor lee el registro de receta sin ser miembro del equipo'
);

-- ---------------------------------------------------------------
-- Caso 8: org_admin no tiene lectura directa, pero sí vía función auditada
-- ---------------------------------------------------------------
select tests.authenticate_as('rx_org_admin');
select is(
  (select count(*)::int from public.prescription_records where id = :'rx_id'),
  0,
  'Caso 8: org_admin no tiene policy de SELECT directa sobre prescription_records'
);

select is(
  (select (admin_read_prescription_record(:'rx_id')).id),
  :'rx_id'::uuid,
  'Caso 8b: org_admin puede leer el registro vía la función de acceso elevado'
);

select * from finish();
rollback;
