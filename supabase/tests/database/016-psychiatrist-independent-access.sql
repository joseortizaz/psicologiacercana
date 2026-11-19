-- Psiquiatra independiente (ver 20260813000000_psychiatrist_independent_access.sql):
--   1. Un psiquiatra puede dar de alta y editar pacientes de su clínica.
--   2. Un psiquiatra puede agendar y editar SUS citas.
--   3. No puede agendar citas a nombre de otro profesional.
--   4. No puede cambiar la cita de otro profesional.
--   5. No puede crear pacientes en otra organización (aislamiento multi-tenant).
--   6. consents: insert/update contemplan a psychiatrist.
--   7. Plan Esencial (1 profesional): un psiquiatra ocupa el cupo y bloquea a un
--      terapeuta adicional, y viceversa.
--   8. Un plan sin límite (Institucional) admite psicólogos y psiquiatras juntos.

begin;
select plan(14);

select tests.authenticate_as_service_role();

-- Ejecuta una sentencia y devuelve 'ok' o el inicio del error (19 caracteres).
create function pg_temp.attempt(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return 'ok';
exception when others then
  return left(sqlerrm, 19);
end $$;
grant execute on function pg_temp.attempt(text) to public;

-- Org Q: plan sin límite, con un psiquiatra y un terapeuta.
insert into public.organizations (name, plan_id)
select 'Org Psiq Q', id from public.plans where code = 'institucional';
select id as org_q from public.organizations where name = 'Org Psiq Q' \gset
insert into public.clinics (organization_id, name) values (:'org_q', 'Clinica Q');
select id as clinic_q from public.clinics where organization_id = :'org_q' \gset

-- Org P: plan Esencial (1 profesional clínico).
insert into public.organizations (name) values ('Org Psiq P');
select id as org_p from public.organizations where name = 'Org Psiq P' \gset
insert into public.clinics (organization_id, name) values (:'org_p', 'Clinica P');
select id as clinic_p from public.clinics where organization_id = :'org_p' \gset

select tests.create_supabase_user('psq_q', 'psq_q@test.com');
select tests.create_supabase_user('ther_q', 'ther_q@test.com');
select tests.create_supabase_user('psq_p', 'psq_p@test.com');
select tests.create_supabase_user('ther_p', 'ther_p@test.com');
select tests.create_supabase_user('ther_p2', 'ther_p2@test.com');
select tests.get_supabase_uid('psq_q') as psq_q_id \gset
select tests.get_supabase_uid('ther_q') as ther_q_id \gset

insert into public.profiles (id, organization_id, clinic_id, role, full_name, email, is_org_admin, must_change_password)
values (:'psq_q_id', :'org_q', :'clinic_q', 'psychiatrist', 'Psiquiatra Q', 'psq_q@test.com', true, false);
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email, must_change_password)
values (:'ther_q_id', :'org_q', :'clinic_q', 'therapist', 'Terapeuta Q', 'ther_q@test.com', false);

-- Un paciente del terapeuta y una cita del terapeuta (para los casos 3 y 4).
insert into public.patients (organization_id, clinic_id, full_name, date_of_birth, category)
values (:'org_q', :'clinic_q', 'Paciente del terapeuta', '1990-01-01', 'adult');
select id as pat_t from public.patients where full_name = 'Paciente del terapeuta' \gset
insert into public.appointments (organization_id, clinic_id, patient_id, therapist_id, start_time, end_time)
values (:'org_q', :'clinic_q', :'pat_t', :'ther_q_id', now() + interval '1 day', now() + interval '1 day 1 hour');
select id as appt_t from public.appointments where therapist_id = :'ther_q_id' \gset

-- ---------------- patients ----------------
select tests.authenticate_as('psq_q');
select is(
  pg_temp.attempt(format($f$insert into public.patients (organization_id, clinic_id, full_name, date_of_birth, category, primary_therapist_id)
                         values (%L, %L, 'Paciente del psiquiatra', '1985-05-05', 'adult', %L)$f$, :'org_q', :'clinic_q', :'psq_q_id')),
  'ok', '1. El psiquiatra puede dar de alta un paciente en su clínica');

select is(
  pg_temp.attempt(format($f$update public.patients set contact_phone = '8095550101' where full_name = 'Paciente del psiquiatra'$f$)),
  'ok', '2a. El psiquiatra puede editar un paciente');
select tests.authenticate_as_service_role();
select is((select contact_phone from public.patients where full_name = 'Paciente del psiquiatra'),
          '8095550101', '2b. La edición del paciente quedó guardada');

-- ---------------- appointments ----------------
select tests.authenticate_as('psq_q');
select tests.authenticate_as_service_role();
select id as pat_p from public.patients where full_name = 'Paciente del psiquiatra' \gset
select tests.authenticate_as('psq_q');
select is(
  pg_temp.attempt(format($f$insert into public.appointments (organization_id, clinic_id, patient_id, therapist_id, start_time, end_time)
                         values (%L, %L, %L, %L, now() + interval '2 days', now() + interval '2 days 1 hour')$f$,
                         :'org_q', :'clinic_q', :'pat_p', :'psq_q_id')),
  'ok', '3. El psiquiatra puede agendar una cita para sí mismo');

select is(
  pg_temp.attempt(format($f$insert into public.appointments (organization_id, clinic_id, patient_id, therapist_id, start_time, end_time)
                         values (%L, %L, %L, %L, now() + interval '3 days', now() + interval '3 days 1 hour')$f$,
                         :'org_q', :'clinic_q', :'pat_p', :'ther_q_id')),
  'new row violates ro', '4. El psiquiatra no puede agendar a nombre de otro profesional');

select is(
  pg_temp.attempt(format($f$update public.appointments set status = 'confirmed' where therapist_id = %L$f$, :'psq_q_id')),
  'ok', '5a. El psiquiatra puede cambiar el estado de su cita');
select pg_temp.attempt(format($f$update public.appointments set status = 'cancelled' where id = %L$f$, :'appt_t'));
select tests.authenticate_as_service_role();
select is(
  (select status::text from public.appointments where id = :'appt_t'),
  'scheduled', '5b. No puede cambiar la cita de otro profesional (RLS la oculta)');
select is(
  (select status::text from public.appointments where therapist_id = :'psq_q_id'),
  'confirmed', '5c. El cambio en su propia cita sí quedó guardado');

-- ---------------- aislamiento ----------------
select tests.authenticate_as('psq_q');
select is(
  pg_temp.attempt(format($f$insert into public.patients (organization_id, clinic_id, full_name, date_of_birth, category)
                         values (%L, %L, 'Intruso', '1990-01-01', 'adult')$f$, :'org_p', :'clinic_p')),
  'new row violates ro', '6. El psiquiatra no puede crear pacientes en otra organización');

-- ---------------- consents ----------------
select tests.authenticate_as_service_role();
select ok(
  (select count(*) = 2 from pg_policies
    where schemaname = 'public' and tablename = 'consents'
      and policyname in ('consents_insert', 'consents_update')
      and coalesce(with_check, '') || coalesce(qual, '') like '%psychiatrist%'),
  '7. Las políticas de consents contemplan a psychiatrist');

-- ---------------- límites de plan ----------------
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email, must_change_password)
values (tests.get_supabase_uid('psq_p'), :'org_p', :'clinic_p', 'psychiatrist', 'Psiquiatra P', 'psq_p@test.com', false);
select is(
  pg_temp.attempt(format($f$insert into public.profiles (id, organization_id, clinic_id, role, full_name, email, must_change_password)
                         values (%L, %L, %L, 'therapist', 'Terapeuta P', 'ther_p@test.com', false)$f$,
                         tests.get_supabase_uid('ther_p'), :'org_p', :'clinic_p')),
  'El plan actual perm', '8. Esencial: el psiquiatra ocupa el cupo y bloquea a un terapeuta adicional');

delete from public.profiles where id = tests.get_supabase_uid('psq_p');
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email, must_change_password)
values (tests.get_supabase_uid('ther_p'), :'org_p', :'clinic_p', 'therapist', 'Terapeuta P', 'ther_p@test.com', false);
select is(
  pg_temp.attempt(format($f$insert into public.profiles (id, organization_id, clinic_id, role, full_name, email, must_change_password)
                         values (%L, %L, %L, 'psychiatrist', 'Psiquiatra P2', 'ther_p2@test.com', false)$f$,
                         tests.get_supabase_uid('ther_p2'), :'org_p', :'clinic_p')),
  'El plan actual perm', '9. Esencial: un terapeuta ocupa el cupo y bloquea a un psiquiatra adicional');

select is(
  (select count(*)::int from public.profiles where organization_id = :'org_q' and role in ('therapist', 'psychiatrist')),
  2, '10. Plan Institucional (sin límite): psicólogo y psiquiatra conviven');

select * from finish();
rollback;
