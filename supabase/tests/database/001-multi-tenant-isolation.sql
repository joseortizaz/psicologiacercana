-- Suite de aislamiento multi-tenant — sección 2.10 del plan de implementación.
-- Cubre los 5 casos mínimos obligatorios antes de cualquier merge a main:
--   1. Org A no ve filas de Org B.
--   2. assistant no ve clinical_records.
--   3. therapist no puede modificar una nota clínica de otro terapeuta.
--   4. Ningún rol de aplicación puede UPDATE/DELETE audit_logs.
--   5. Un token de Org A no puede insertar filas con organization_id de Org B.
-- Más 3 controles adicionales (RLS habilitado en todo public, y dos
-- controles positivos para confirmar que no estamos bloqueando de más).

begin;
select plan(9);

-- ---------------------------------------------------------------
-- Setup (como service_role, que ignora RLS)
-- ---------------------------------------------------------------
select tests.authenticate_as_service_role();

select tests.create_supabase_user('org_admin_a', 'org_admin_a@test.com');
select tests.create_supabase_user('therapist_a1', 'therapist_a1@test.com');
select tests.create_supabase_user('therapist_a2', 'therapist_a2@test.com');
select tests.create_supabase_user('assistant_a', 'assistant_a@test.com');
select tests.create_supabase_user('therapist_b1', 'therapist_b1@test.com');

with org_a as (
  insert into public.organizations (name) values ('Org A - Test') returning id
), org_b as (
  insert into public.organizations (name) values ('Org B - Test') returning id
), clinic_a as (
  insert into public.clinics (organization_id, name)
  select id, 'Clínica A' from org_a returning id, organization_id
), clinic_b as (
  insert into public.clinics (organization_id, name)
  select id, 'Clínica B' from org_b returning id, organization_id
)
select 1;

-- Capturamos los ids de Org B como variables psql MIENTRAS aún somos
-- service_role (bypass RLS). Los necesitamos en el Caso 5 para construir un
-- INSERT con un organization_id ajeno real (no inventado), pero para
-- entonces ya estaremos autenticados como therapist_a1, que por RLS no
-- puede ver Org B — de ahí que se capturen aquí, no allá.
select id as org_b_id from public.organizations where name = 'Org B - Test' \gset
select id as clinic_b_id from public.clinics where organization_id = :'org_b_id' \gset

-- Perfiles
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
select tests.get_supabase_uid('org_admin_a'), o.id, null, 'org_admin', 'Org Admin A', 'org_admin_a@test.com'
from public.organizations o where o.name = 'Org A - Test';

insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
select tests.get_supabase_uid('therapist_a1'), o.id, c.id, 'therapist', 'Terapeuta A1', 'therapist_a1@test.com'
from public.organizations o join public.clinics c on c.organization_id = o.id
where o.name = 'Org A - Test';

insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
select tests.get_supabase_uid('therapist_a2'), o.id, c.id, 'therapist', 'Terapeuta A2', 'therapist_a2@test.com'
from public.organizations o join public.clinics c on c.organization_id = o.id
where o.name = 'Org A - Test';

insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
select tests.get_supabase_uid('assistant_a'), o.id, c.id, 'assistant', 'Asistente A', 'assistant_a@test.com'
from public.organizations o join public.clinics c on c.organization_id = o.id
where o.name = 'Org A - Test';

insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
select tests.get_supabase_uid('therapist_b1'), o.id, c.id, 'therapist', 'Terapeuta B1', 'therapist_b1@test.com'
from public.organizations o join public.clinics c on c.organization_id = o.id
where o.name = 'Org B - Test';

-- Un paciente en cada organización, y un expediente clínico para el de Org A
insert into public.patients (organization_id, clinic_id, full_name, date_of_birth, category, primary_therapist_id)
select o.id, c.id, 'Paciente Org A', '1990-01-01', 'adult', tests.get_supabase_uid('therapist_a1')
from public.organizations o join public.clinics c on c.organization_id = o.id
where o.name = 'Org A - Test';

insert into public.patients (organization_id, clinic_id, full_name, date_of_birth, category, primary_therapist_id)
select o.id, c.id, 'Paciente Org B', '1990-01-01', 'adult', tests.get_supabase_uid('therapist_b1')
from public.organizations o join public.clinics c on c.organization_id = o.id
where o.name = 'Org B - Test';

insert into public.clinical_records (organization_id, clinic_id, patient_id, primary_therapist_id, chief_complaint)
select p.organization_id, p.clinic_id, p.id, tests.get_supabase_uid('therapist_a1'), 'Motivo original'
from public.patients p where p.full_name = 'Paciente Org A';

-- ---------------------------------------------------------------
-- Caso 1: aislamiento cruzado de organización (patients)
-- ---------------------------------------------------------------
select tests.authenticate_as('therapist_a1');
select is(
  (select count(*)::int from public.patients where full_name = 'Paciente Org B'),
  0,
  'Caso 1: un usuario de Org A obtiene 0 filas al leer un paciente de Org B'
);

-- ---------------------------------------------------------------
-- Caso 2: assistant no ve clinical_records
-- ---------------------------------------------------------------
select tests.authenticate_as('assistant_a');
select is(
  (select count(*)::int from public.clinical_records),
  0,
  'Caso 2: un usuario con rol assistant obtiene 0 filas al leer clinical_records'
);

-- ---------------------------------------------------------------
-- Caso 3: therapist no puede modificar la nota clínica de otro terapeuta
-- ---------------------------------------------------------------
select tests.authenticate_as('therapist_a2');
update public.clinical_records
set chief_complaint = 'Intento de modificación no autorizada'
where patient_id = (select id from public.patients where full_name = 'Paciente Org A');

select tests.authenticate_as_service_role();
select is(
  (select chief_complaint from public.clinical_records
     where patient_id = (select id from public.patients where full_name = 'Paciente Org A')),
  'Motivo original',
  'Caso 3: el UPDATE de otro terapeuta no tuvo efecto (RLS lo filtró en silencio)'
);

-- ---------------------------------------------------------------
-- Caso 4: ningún rol de aplicación puede UPDATE/DELETE audit_logs
-- ---------------------------------------------------------------
select tests.authenticate_as('org_admin_a');
select throws_ok(
  $$ update audit_logs set action = 'TAMPERED' where true $$,
  '42501',
  null,
  'Caso 4a: org_admin no puede hacer UPDATE sobre audit_logs'
);
select throws_ok(
  $$ delete from audit_logs where true $$,
  '42501',
  null,
  'Caso 4b: org_admin no puede hacer DELETE sobre audit_logs'
);

-- ---------------------------------------------------------------
-- Caso 5: un token de Org A no puede insertar con organization_id de Org B
-- ---------------------------------------------------------------
select tests.authenticate_as('therapist_a1');
select throws_ok(
  format(
    $$ insert into patients (organization_id, clinic_id, full_name, date_of_birth, category, primary_therapist_id)
       values ('%s', '%s', 'Paciente falsificado', '1990-01-01', 'adult', '%s') $$,
    :'org_b_id',
    :'clinic_b_id',
    tests.get_supabase_uid('therapist_a1')
  ),
  '42501',
  null,
  'Caso 5: un usuario de Org A no puede insertar un paciente con organization_id de Org B'
);

-- ---------------------------------------------------------------
-- Controles adicionales
-- ---------------------------------------------------------------

-- RLS habilitado en todo el esquema public (barrida general).
select tests.authenticate_as_service_role();
select tests.rls_enabled('public');

-- Control positivo: assistant SÍ debe ver pacientes de su propia clínica
-- (para confirmar que no estamos bloqueando de más).
select tests.authenticate_as('assistant_a');
select is(
  (select count(*)::int from public.patients where full_name = 'Paciente Org A'),
  1,
  'Control positivo: assistant sí ve pacientes de su propia organización/clínica'
);

-- Control positivo: el terapeuta dueño del expediente sí lo puede actualizar.
select tests.authenticate_as('therapist_a1');
update public.clinical_records
set chief_complaint = 'Actualizado por el dueño'
where patient_id = (select id from public.patients where full_name = 'Paciente Org A');

select is(
  (select chief_complaint from public.clinical_records
     where patient_id = (select id from public.patients where full_name = 'Paciente Org A')),
  'Actualizado por el dueño',
  'Control positivo: el terapeuta dueño del expediente sí puede actualizarlo'
);

select * from finish();
rollback;
