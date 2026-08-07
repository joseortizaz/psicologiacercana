-- Módulo de psiquiatría — Fases 1-3 (ver 20260807000000_psychiatrist_role.sql
-- y 20260807000001_psychiatry_care_team.sql):
--   1. 'psychiatrist' exige clinic_id igual que therapist/assistant/supervisor.
--   2. Al crear un clinical_records, el creador queda auto-incluido en el
--      equipo de atención.
--   3. Un miembro del equipo agregado después (el psiquiatra) puede leer el
--      expediente y registrar sus propias consultas.
--   4. Un clínico de la misma organización que NO es miembro del equipo no
--      ve nada (ni el expediente ni sus consultas).
--   5. La escritura de una consulta sigue restringida a su autor, aunque la
--      lectura ahora sea compartida entre el equipo.
--   6. supervisor conserva su acceso de solo lectura a nivel de clínica.
--   7. Aislamiento entre organizaciones se mantiene bajo el nuevo modelo.
--   8. El script de backfill (sección 4 de la migración) repuebla
--      correctamente un clinical_record que quedó sin miembros de equipo.

begin;
select plan(13);

-- ---------------------------------------------------------------
-- Setup (como service_role, que ignora RLS)
-- ---------------------------------------------------------------
select tests.authenticate_as_service_role();

insert into public.organizations (name, plan_id)
select 'Org Psiquiatría - Test', id from public.plans where code = 'institucional';
select id as org_id from public.organizations where name = 'Org Psiquiatría - Test' \gset

insert into public.clinics (organization_id, name) values (:'org_id', 'Clínica Psiquiatría');
select id as clinic_id from public.clinics where organization_id = :'org_id' \gset

insert into public.organizations (name) values ('Org Psiquiatría B - Test');
select id as org_b_id from public.organizations where name = 'Org Psiquiatría B - Test' \gset
insert into public.clinics (organization_id, name) values (:'org_b_id', 'Clínica B');
select id as clinic_b_id from public.clinics where organization_id = :'org_b_id' \gset

select tests.create_supabase_user('team_therapist', 'team_therapist@test.com');
select tests.create_supabase_user('team_psychiatrist', 'team_psychiatrist@test.com');
select tests.create_supabase_user('team_outsider', 'team_outsider@test.com');
select tests.create_supabase_user('team_supervisor', 'team_supervisor@test.com');
select tests.create_supabase_user('other_org_therapist', 'other_org_therapist@test.com');

insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('team_therapist'), :'org_id', :'clinic_id', 'therapist', 'Terapeuta Equipo', 'team_therapist@test.com');

insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('team_outsider'), :'org_id', :'clinic_id', 'therapist', 'Terapeuta Fuera del Equipo', 'team_outsider@test.com');

insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('team_supervisor'), :'org_id', :'clinic_id', 'supervisor', 'Supervisor Equipo', 'team_supervisor@test.com');

insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('other_org_therapist'), :'org_b_id', :'clinic_b_id', 'therapist', 'Terapeuta Org B', 'other_org_therapist@test.com');

-- ---------------------------------------------------------------
-- Caso 1: 'psychiatrist' sin clinic_id viola clinic_required_for_clinic_staff
-- ---------------------------------------------------------------
select throws_ok(
  format(
    $$ insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
       values ('%s', '%s', null, 'psychiatrist', 'Psiquiatra Sin Clínica', 'psiq-sin-clinica@test.com') $$,
    tests.get_supabase_uid('team_psychiatrist'),
    :'org_id'
  ),
  '23514',
  null,
  'Caso 1: un profile con role psychiatrist sin clinic_id viola clinic_required_for_clinic_staff'
);

-- ---------------------------------------------------------------
-- Caso 2: 'psychiatrist' CON clinic_id sí se puede crear
-- ---------------------------------------------------------------
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('team_psychiatrist'), :'org_id', :'clinic_id', 'psychiatrist', 'Psiquiatra Equipo', 'team_psychiatrist@test.com');

select is(
  (select count(*)::int from public.profiles where email = 'team_psychiatrist@test.com' and role = 'psychiatrist'),
  1,
  'Caso 2: un profile con role psychiatrist y clinic_id se crea correctamente'
);

-- Paciente + expediente clínico, creado por el terapeuta.
insert into public.patients (organization_id, clinic_id, full_name, date_of_birth, category, primary_therapist_id)
select :'org_id', :'clinic_id', 'Paciente Equipo', '1990-01-01', 'adult', tests.get_supabase_uid('team_therapist');
select id as patient_id from public.patients where full_name = 'Paciente Equipo' \gset

insert into public.clinical_records (organization_id, clinic_id, patient_id, primary_therapist_id, chief_complaint)
values (:'org_id', :'clinic_id', :'patient_id', tests.get_supabase_uid('team_therapist'), 'Motivo inicial');
select id as record_id from public.clinical_records where patient_id = :'patient_id' \gset

-- ---------------------------------------------------------------
-- Caso 3: el creador queda auto-incluido en el equipo de atención
-- ---------------------------------------------------------------
select is(
  (select count(*)::int from public.clinical_record_team_members
     where clinical_record_id = :'record_id'
       and clinician_id = tests.get_supabase_uid('team_therapist')
       and active),
  1,
  'Caso 3: el terapeuta creador queda auto-incluido como miembro activo del equipo'
);

-- El terapeuta agrega al psiquiatra al equipo.
select tests.authenticate_as('team_therapist');
insert into public.clinical_record_team_members (clinical_record_id, clinician_id)
values (:'record_id', tests.get_supabase_uid('team_psychiatrist'));

-- ---------------------------------------------------------------
-- Caso 4: el psiquiatra, ya miembro del equipo, puede leer el expediente
-- ---------------------------------------------------------------
select tests.authenticate_as('team_psychiatrist');
select is(
  (select count(*)::int from public.clinical_records where id = :'record_id'),
  1,
  'Caso 4: un miembro del equipo agregado después (psiquiatra) puede leer el expediente compartido'
);

-- ---------------------------------------------------------------
-- Caso 5: un terapeuta de la misma organización que NO es miembro no ve nada
-- ---------------------------------------------------------------
select tests.authenticate_as('team_outsider');
select is(
  (select count(*)::int from public.clinical_records where id = :'record_id'),
  0,
  'Caso 5: un clínico de la misma organización que no es miembro del equipo no ve el expediente'
);

-- ---------------------------------------------------------------
-- Caso 6: el psiquiatra puede registrar su propia consulta en el expediente compartido
-- ---------------------------------------------------------------
select tests.authenticate_as('team_psychiatrist');
insert into public.consultations (organization_id, clinic_id, patient_id, clinical_record_id, therapist_id, reason)
values (:'org_id', :'clinic_id', :'patient_id', :'record_id', tests.get_supabase_uid('team_psychiatrist'), 'Evaluación psiquiátrica');

select tests.authenticate_as_service_role();
select is(
  (select count(*)::int from public.consultations
     where clinical_record_id = :'record_id' and therapist_id = tests.get_supabase_uid('team_psychiatrist')),
  1,
  'Caso 6: un miembro del equipo que no es el primary_therapist_id sí puede insertar su propia consulta'
);

-- ---------------------------------------------------------------
-- Caso 7: el terapeuta (miembro del equipo) lee la consulta del psiquiatra
-- ---------------------------------------------------------------
select tests.authenticate_as('team_therapist');
select is(
  (select count(*)::int from public.consultations
     where clinical_record_id = :'record_id' and reason = 'Evaluación psiquiátrica'),
  1,
  'Caso 7: un miembro del equipo lee las consultas registradas por otro miembro (visibilidad compartida)'
);

-- ---------------------------------------------------------------
-- Caso 8: la escritura de una consulta se mantiene restringida a su autor
-- ---------------------------------------------------------------
update public.consultations
set reason = 'Intento de edición no autorizada'
where clinical_record_id = :'record_id' and reason = 'Evaluación psiquiátrica';

select tests.authenticate_as_service_role();
select is(
  (select reason from public.consultations
     where clinical_record_id = :'record_id' and therapist_id = tests.get_supabase_uid('team_psychiatrist')),
  'Evaluación psiquiátrica',
  'Caso 8: un miembro del equipo que no es el autor no puede modificar la consulta de otro (RLS lo filtró en silencio)'
);

-- ---------------------------------------------------------------
-- Caso 9: supervisor conserva su acceso de solo lectura a nivel de clínica
-- ---------------------------------------------------------------
select tests.authenticate_as('team_supervisor');
select is(
  (select count(*)::int from public.clinical_records where id = :'record_id'),
  1,
  'Caso 9: supervisor sigue viendo los expedientes de su clínica sin necesidad de ser miembro del equipo'
);

-- ---------------------------------------------------------------
-- Caso 10: aislamiento entre organizaciones se mantiene bajo el nuevo modelo
-- ---------------------------------------------------------------
select tests.authenticate_as('other_org_therapist');
select is(
  (select count(*)::int from public.clinical_records where id = :'record_id'),
  0,
  'Caso 10: un clínico de otra organización no ve el expediente aunque conozca su id'
);

select is(
  (select count(*)::int from public.clinical_record_team_members where clinical_record_id = :'record_id'),
  0,
  'Caso 10b: un clínico de otra organización tampoco ve las filas de clinical_record_team_members'
);

-- ---------------------------------------------------------------
-- Caso 11: el script de backfill repuebla un expediente sin miembros
-- ---------------------------------------------------------------
-- Simula un clinical_records "legacy" (previo a esta migración, sin ningún
-- miembro de equipo) borrando la fila que el trigger de auto-inclusión
-- acaba de crear, y vuelve a correr el mismo INSERT ... SELECT del backfill
-- (sección 4 de 20260807000001_psychiatry_care_team.sql) de forma aislada.
select tests.authenticate_as_service_role();

delete from public.clinical_record_team_members
where clinical_record_id = :'record_id' and clinician_id = tests.get_supabase_uid('team_therapist');

select is(
  (select count(*)::int from public.clinical_record_team_members where clinical_record_id = :'record_id'
     and clinician_id = tests.get_supabase_uid('team_therapist')),
  0,
  'Caso 11a: se simula un expediente "legacy" sin el terapeuta creador en el equipo'
);

insert into public.clinical_record_team_members
  (clinical_record_id, clinician_id, organization_id, role_in_team, active, added_by, added_at)
select
  cr.id,
  cr.primary_therapist_id,
  cr.organization_id,
  p.role::text,
  true,
  coalesce(cr.created_by, cr.primary_therapist_id),
  cr.created_at
from public.clinical_records cr
join public.profiles p on p.id = cr.primary_therapist_id
where cr.id = :'record_id'
on conflict (clinical_record_id, clinician_id) do nothing;

select is(
  (select count(*)::int from public.clinical_record_team_members where clinical_record_id = :'record_id'
     and clinician_id = tests.get_supabase_uid('team_therapist') and active),
  1,
  'Caso 11b: el script de backfill repuebla correctamente al terapeuta como miembro del equipo'
);

select * from finish();
rollback;
