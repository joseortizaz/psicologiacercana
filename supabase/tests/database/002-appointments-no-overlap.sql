-- Regresión: `appointments_no_overlap` debe ser un EXCLUDE constraint real,
-- no solo un índice de apoyo — ver
-- 20260803000000_appointments_no_overlap_exclude.sql. Verifica que es la
-- base de datos, y no solo la UI, la que impide agendar dos citas encimadas
-- para el mismo terapeuta.

begin;
select plan(4);

select tests.authenticate_as_service_role();

-- 2 terapeutas en la misma org: se le asigna el plan Institucional (sin
-- límites) para no acoplar este test a los límites de planes (ver
-- enforce_plan_limits en 20260805000000_subscription_plans.sql).
insert into public.organizations (name, plan_id)
select 'Org Overlap - Test', id from public.plans where code = 'institucional';
select id as org_id from public.organizations where name = 'Org Overlap - Test' \gset

insert into public.clinics (organization_id, name) values (:'org_id', 'Clínica Overlap');
select id as clinic_id from public.clinics where organization_id = :'org_id' \gset

select tests.create_supabase_user('therapist_overlap_1', 'therapist_overlap_1@test.com');
select tests.create_supabase_user('therapist_overlap_2', 'therapist_overlap_2@test.com');

insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (
  tests.get_supabase_uid('therapist_overlap_1'), :'org_id', :'clinic_id',
  'therapist', 'Terapeuta Overlap 1', 'therapist_overlap_1@test.com'
);

insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (
  tests.get_supabase_uid('therapist_overlap_2'), :'org_id', :'clinic_id',
  'therapist', 'Terapeuta Overlap 2', 'therapist_overlap_2@test.com'
);

insert into public.patients (organization_id, clinic_id, full_name, date_of_birth, category, primary_therapist_id)
values (:'org_id', :'clinic_id', 'Paciente Overlap', '1990-01-01', 'adult', tests.get_supabase_uid('therapist_overlap_1'));
select id as patient_id from public.patients where full_name = 'Paciente Overlap' \gset

-- Cita base: therapist_overlap_1, 10:00–10:50.
insert into public.appointments (organization_id, clinic_id, patient_id, therapist_id, start_time, end_time)
values (
  :'org_id', :'clinic_id', :'patient_id', tests.get_supabase_uid('therapist_overlap_1'),
  '2026-09-01 10:00:00-06', '2026-09-01 10:50:00-06'
);

-- ---------------------------------------------------------------
-- Caso 1: una cita encimada para el MISMO terapeuta debe ser rechazada.
-- ---------------------------------------------------------------
select throws_ok(
  format(
    $$ insert into public.appointments (organization_id, clinic_id, patient_id, therapist_id, start_time, end_time)
       values ('%s', '%s', '%s', '%s', '2026-09-01 10:30:00-06', '2026-09-01 11:00:00-06') $$,
    :'org_id', :'clinic_id', :'patient_id', tests.get_supabase_uid('therapist_overlap_1')
  ),
  '23P01',
  null,
  'Caso 1: una cita encimada para el mismo terapeuta es rechazada por la base de datos'
);

-- ---------------------------------------------------------------
-- Caso 2: un horario consecutivo (sin traslape) para el mismo terapeuta sí
-- se permite.
-- ---------------------------------------------------------------
select lives_ok(
  format(
    $$ insert into public.appointments (organization_id, clinic_id, patient_id, therapist_id, start_time, end_time)
       values ('%s', '%s', '%s', '%s', '2026-09-01 11:00:00-06', '2026-09-01 11:50:00-06') $$,
    :'org_id', :'clinic_id', :'patient_id', tests.get_supabase_uid('therapist_overlap_1')
  ),
  'Caso 2: un horario consecutivo (sin traslape) para el mismo terapeuta sí se permite'
);

-- ---------------------------------------------------------------
-- Caso 3: el mismo horario encimado, pero para OTRO terapeuta, sí se
-- permite (el EXCLUDE está scoped por therapist_id).
-- ---------------------------------------------------------------
select lives_ok(
  format(
    $$ insert into public.appointments (organization_id, clinic_id, patient_id, therapist_id, start_time, end_time)
       values ('%s', '%s', '%s', '%s', '2026-09-01 10:00:00-06', '2026-09-01 10:50:00-06') $$,
    :'org_id', :'clinic_id', :'patient_id', tests.get_supabase_uid('therapist_overlap_2')
  ),
  'Caso 3: el mismo horario encimado para OTRO terapeuta sí se permite'
);

-- ---------------------------------------------------------------
-- Caso 4: una cita CANCELADA no bloquea un nuevo horario encimado en su
-- lugar (predicado WHERE status <> 'cancelled' del EXCLUDE).
-- ---------------------------------------------------------------
update public.appointments
set status = 'cancelled'
where therapist_id = tests.get_supabase_uid('therapist_overlap_1')
  and start_time = '2026-09-01 10:00:00-06';

select lives_ok(
  format(
    $$ insert into public.appointments (organization_id, clinic_id, patient_id, therapist_id, start_time, end_time)
       values ('%s', '%s', '%s', '%s', '2026-09-01 10:00:00-06', '2026-09-01 10:50:00-06') $$,
    :'org_id', :'clinic_id', :'patient_id', tests.get_supabase_uid('therapist_overlap_1')
  ),
  'Caso 4: una cita cancelada no bloquea un nuevo horario encimado en su lugar'
);

select * from finish();
rollback;
