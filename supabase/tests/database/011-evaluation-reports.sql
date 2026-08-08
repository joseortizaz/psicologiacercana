-- Registro de Evaluaciones (ver 20260808020000_evaluation_reports.sql):
--   1. Solo un therapist miembro activo del equipo puede crear una
--      evaluación, y solo a su propio nombre (administered_by = auth.uid()).
--   2. psychiatrist (aunque sea miembro del equipo) no puede crear
--      evaluaciones -- exclusivo del psicólogo tratante.
--   3. Lectura compartida entre miembros del equipo (incluye psychiatrist) +
--      supervisor a nivel de clínica; quien no es miembro no ve nada;
--      aislamiento entre organizaciones.
--   4. assistant no tiene acceso bajo ninguna modalidad.
--   5. Solo el propio autor puede editar su evaluación (otro miembro del
--      equipo no puede), y nadie puede editar una vez finalizada.
--   6. DELETE siempre bloqueado, incluso para el autor.
--   7. org_admin no tiene lectura directa, solo vía
--      admin_read_evaluation_report() (auditada).

begin;
select plan(15);

select tests.authenticate_as_service_role();

insert into public.organizations (name, plan_id)
select 'Org Evaluaciones - Test', id from public.plans where code = 'institucional';
select id as org_id from public.organizations where name = 'Org Evaluaciones - Test' \gset
insert into public.clinics (organization_id, name) values (:'org_id', 'Clínica Evaluaciones');
select id as clinic_id from public.clinics where organization_id = :'org_id' \gset

insert into public.organizations (name, plan_id)
select 'Org Evaluaciones Otra - Test', id from public.plans where code = 'institucional';
select id as other_org_id from public.organizations where name = 'Org Evaluaciones Otra - Test' \gset
insert into public.clinics (organization_id, name) values (:'other_org_id', 'Clínica Otra Org');
select id as other_clinic_id from public.clinics where organization_id = :'other_org_id' \gset

select tests.create_supabase_user('ev_therapist', 'ev_therapist@test.com');
select tests.create_supabase_user('ev_therapist_2', 'ev_therapist_2@test.com');
select tests.create_supabase_user('ev_psychiatrist', 'ev_psychiatrist@test.com');
select tests.create_supabase_user('ev_outsider', 'ev_outsider@test.com');
select tests.create_supabase_user('ev_supervisor', 'ev_supervisor@test.com');
select tests.create_supabase_user('ev_org_admin', 'ev_org_admin@test.com');
select tests.create_supabase_user('ev_assistant', 'ev_assistant@test.com');
select tests.create_supabase_user('ev_other_org_therapist', 'ev_other_org_therapist@test.com');

insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('ev_therapist'), :'org_id', :'clinic_id', 'therapist', 'Terapeuta Evaluaciones', 'ev_therapist@test.com');
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('ev_therapist_2'), :'org_id', :'clinic_id', 'therapist', 'Terapeuta Evaluaciones 2', 'ev_therapist_2@test.com');
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('ev_psychiatrist'), :'org_id', :'clinic_id', 'psychiatrist', 'Psiquiatra Evaluaciones', 'ev_psychiatrist@test.com');
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('ev_outsider'), :'org_id', :'clinic_id', 'therapist', 'Terapeuta Fuera del Equipo', 'ev_outsider@test.com');
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('ev_supervisor'), :'org_id', :'clinic_id', 'supervisor', 'Supervisor Evaluaciones', 'ev_supervisor@test.com');
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('ev_org_admin'), :'org_id', null, 'org_admin', 'Admin Evaluaciones', 'ev_org_admin@test.com');
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('ev_assistant'), :'org_id', :'clinic_id', 'assistant', 'Asistente Evaluaciones', 'ev_assistant@test.com');
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('ev_other_org_therapist'), :'other_org_id', :'other_clinic_id', 'therapist', 'Terapeuta Otra Org', 'ev_other_org_therapist@test.com');

insert into public.patients (organization_id, clinic_id, full_name, date_of_birth, category, primary_therapist_id)
select :'org_id', :'clinic_id', 'Paciente Evaluaciones', '1990-05-05', 'adult', tests.get_supabase_uid('ev_therapist');
select id as patient_id from public.patients where full_name = 'Paciente Evaluaciones' \gset

insert into public.clinical_records (organization_id, clinic_id, patient_id, primary_therapist_id, chief_complaint)
values (:'org_id', :'clinic_id', :'patient_id', tests.get_supabase_uid('ev_therapist'), 'Motivo evaluaciones');
select id as record_id from public.clinical_records where patient_id = :'patient_id' \gset

select tests.authenticate_as('ev_therapist');
insert into public.clinical_record_team_members (clinical_record_id, clinician_id)
values (:'record_id', tests.get_supabase_uid('ev_psychiatrist'));

-- ---------------------------------------------------------------
-- Caso 1: un psychiatrist miembro del equipo no puede crear una evaluación
-- ---------------------------------------------------------------
select tests.authenticate_as('ev_psychiatrist');
select throws_ok(
  format(
    $$ insert into public.evaluation_reports
         (organization_id, clinic_id, patient_id, clinical_record_id, administered_by, test_name)
       values ('%s','%s','%s','%s','%s','WISC-V') $$,
    :'org_id', :'clinic_id', :'patient_id', :'record_id', tests.get_supabase_uid('ev_psychiatrist')
  ),
  '42501',
  null,
  'Caso 1: un psychiatrist miembro del equipo no puede crear una evaluación (exclusivo del therapist)'
);

-- ---------------------------------------------------------------
-- Caso 2: un therapist que NO es miembro del equipo tampoco puede
-- ---------------------------------------------------------------
select tests.authenticate_as('ev_outsider');
select throws_ok(
  format(
    $$ insert into public.evaluation_reports
         (organization_id, clinic_id, patient_id, clinical_record_id, administered_by, test_name)
       values ('%s','%s','%s','%s','%s','WISC-V') $$,
    :'org_id', :'clinic_id', :'patient_id', :'record_id', tests.get_supabase_uid('ev_outsider')
  ),
  '42501',
  null,
  'Caso 2: un therapist que no es miembro del equipo no puede crear una evaluación'
);

-- ---------------------------------------------------------------
-- Caso 3: un assistant no puede crear una evaluación
-- ---------------------------------------------------------------
select tests.authenticate_as('ev_assistant');
select throws_ok(
  format(
    $$ insert into public.evaluation_reports
         (organization_id, clinic_id, patient_id, clinical_record_id, administered_by, test_name)
       values ('%s','%s','%s','%s','%s','WISC-V') $$,
    :'org_id', :'clinic_id', :'patient_id', :'record_id', tests.get_supabase_uid('ev_assistant')
  ),
  '42501',
  null,
  'Caso 3: un assistant no puede crear una evaluación'
);

-- ---------------------------------------------------------------
-- Caso 4: el therapist miembro del equipo SÍ puede crear la evaluación
-- ---------------------------------------------------------------
select tests.authenticate_as('ev_therapist');
insert into public.evaluation_reports
  (organization_id, clinic_id, patient_id, clinical_record_id, administered_by, test_name, score_summary, interpretation)
values
  (:'org_id', :'clinic_id', :'patient_id', :'record_id', tests.get_supabase_uid('ev_therapist'), 'WISC-V', 'CIT: 95', 'Rendimiento intelectual dentro del promedio.');

select tests.authenticate_as_service_role();
select is(
  (select count(*)::int from public.evaluation_reports where clinical_record_id = :'record_id'),
  1,
  'Caso 4: un therapist miembro activo del equipo sí puede crear una evaluación'
);
select id as eval_id from public.evaluation_reports where clinical_record_id = :'record_id' \gset

-- ---------------------------------------------------------------
-- Caso 5: el psychiatrist (miembro del equipo) lee la evaluación
-- ---------------------------------------------------------------
select tests.authenticate_as('ev_psychiatrist');
select is(
  (select count(*)::int from public.evaluation_reports where id = :'eval_id'),
  1,
  'Caso 5: un psychiatrist miembro del equipo sí puede leer la evaluación (aunque no pueda crearla)'
);

-- ---------------------------------------------------------------
-- Caso 6: quien no es miembro del equipo no ve nada
-- ---------------------------------------------------------------
select tests.authenticate_as('ev_outsider');
select is(
  (select count(*)::int from public.evaluation_reports where id = :'eval_id'),
  0,
  'Caso 6: un clínico que no es miembro del equipo no ve la evaluación'
);

-- ---------------------------------------------------------------
-- Caso 7: aislamiento entre organizaciones
-- ---------------------------------------------------------------
select tests.authenticate_as('ev_other_org_therapist');
select is(
  (select count(*)::int from public.evaluation_reports where id = :'eval_id'),
  0,
  'Caso 7: un therapist de otra organización no ve la evaluación (aislamiento multi-tenant)'
);

-- ---------------------------------------------------------------
-- Caso 8: supervisor lee la evaluación a nivel de clínica
-- ---------------------------------------------------------------
select tests.authenticate_as('ev_supervisor');
select is(
  (select count(*)::int from public.evaluation_reports where id = :'eval_id'),
  1,
  'Caso 8: supervisor lee la evaluación sin ser miembro del equipo'
);

-- ---------------------------------------------------------------
-- Caso 9: assistant no ve nada
-- ---------------------------------------------------------------
select tests.authenticate_as('ev_assistant');
select is(
  (select count(*)::int from public.evaluation_reports where id = :'eval_id'),
  0,
  'Caso 9: un assistant no ve la evaluación bajo ninguna modalidad'
);

-- ---------------------------------------------------------------
-- Caso 10: org_admin no tiene lectura directa, pero sí vía función auditada
-- ---------------------------------------------------------------
select tests.authenticate_as('ev_org_admin');
select is(
  (select count(*)::int from public.evaluation_reports where id = :'eval_id'),
  0,
  'Caso 10: org_admin no tiene policy de SELECT directa sobre evaluation_reports'
);
select is(
  (select (admin_read_evaluation_report(:'eval_id')).id),
  :'eval_id'::uuid,
  'Caso 10b: org_admin puede leer la evaluación vía la función de acceso elevado'
);

-- ---------------------------------------------------------------
-- Caso 11: otro miembro del equipo (therapist_2) no puede editar la
-- evaluación de otro autor -- solo el propio administered_by
-- ---------------------------------------------------------------
select tests.authenticate_as('ev_therapist');
insert into public.clinical_record_team_members (clinical_record_id, clinician_id)
values (:'record_id', tests.get_supabase_uid('ev_therapist_2'));

select tests.authenticate_as('ev_therapist_2');
update public.evaluation_reports set score_summary = 'Editado por otro terapeuta' where id = :'eval_id';

select tests.authenticate_as_service_role();
select is(
  (select score_summary from public.evaluation_reports where id = :'eval_id'),
  'CIT: 95',
  'Caso 11: otro miembro del equipo (no autor) no puede editar la evaluación -- UPDATE no afecta ninguna fila'
);

-- ---------------------------------------------------------------
-- Caso 12: el propio autor SÍ puede editar mientras está en borrador
-- ---------------------------------------------------------------
select tests.authenticate_as('ev_therapist');
update public.evaluation_reports set score_summary = 'CIT: 97 (revisado)' where id = :'eval_id';

select tests.authenticate_as_service_role();
select is(
  (select score_summary from public.evaluation_reports where id = :'eval_id'),
  'CIT: 97 (revisado)',
  'Caso 12: el propio autor sí puede editar su evaluación mientras está en borrador'
);

-- ---------------------------------------------------------------
-- Caso 13: nadie puede editar una vez finalizada (incluido el propio autor)
-- ---------------------------------------------------------------
select tests.authenticate_as('ev_therapist');
update public.evaluation_reports set status = 'finalized', finalized_at = now() where id = :'eval_id';

select throws_ok(
  format($$ update public.evaluation_reports set score_summary = 'Intento post-finalización' where id = '%s' $$, :'eval_id'),
  'P0001',
  null,
  'Caso 13: nadie puede editar una evaluación ya finalizada, ni siquiera el propio autor'
);

-- ---------------------------------------------------------------
-- Caso 14: DELETE siempre bloqueado, incluso para el autor. Sin policy de
-- DELETE, la fila simplemente no queda visible para el DELETE (falla de
-- USING, en silencio -- afecta 0 filas, no lanza excepción; ver "gotcha" de
-- USING vs WITH CHECK en el plan del módulo de psiquiatría, sección 1.1).
-- ---------------------------------------------------------------
delete from public.evaluation_reports where id = :'eval_id';

select tests.authenticate_as_service_role();
select is(
  (select count(*)::int from public.evaluation_reports where id = :'eval_id'),
  1,
  'Caso 14: DELETE está siempre bloqueado (incluso para el autor) -- la fila sigue existiendo tras el intento'
);

select * from finish();
rollback;
