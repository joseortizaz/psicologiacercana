-- Formulario de contacto de la landing page (ver
-- 20260808010000_contact_requests.sql):
--   1. Un visitante anónimo puede insertar una solicitud de contacto.
--   2. Un usuario autenticado (therapist) también puede insertar.
--   3. Ni anon ni un therapist pueden leer las solicitudes (RLS: solo
--      super_admin).
--   4. super_admin sí puede leer todas las solicitudes.
--   5. Un plan_interest fuera de los valores permitidos es rechazado (check
--      constraint).
--   6. Un nombre en blanco es rechazado (check constraint).

begin;
select plan(6);

select tests.authenticate_as_service_role();

insert into public.organizations (name)
values ('Org Contact Requests - Test');
select id as org_id from public.organizations where name = 'Org Contact Requests - Test' \gset

insert into public.clinics (organization_id, name) values (:'org_id', 'Clínica Contact Requests');
select id as clinic_id from public.clinics where organization_id = :'org_id' \gset

select tests.create_supabase_user('contact_therapist', 'contact_therapist@test.com');
select tests.create_supabase_user('contact_super_admin', 'contact_super_admin@test.com');

insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (
  tests.get_supabase_uid('contact_therapist'), :'org_id', :'clinic_id',
  'therapist', 'Terapeuta Contact', 'contact_therapist@test.com'
);

insert into public.profiles (id, organization_id, role, full_name, email)
values (tests.get_supabase_uid('contact_super_admin'), null, 'super_admin', 'Super Admin Contact', 'contact_super_admin@test.com');

-- ---------------------------------------------------------------
-- Caso 1: un visitante anónimo puede insertar una solicitud de contacto.
-- ---------------------------------------------------------------
select tests.clear_authentication();
set local role anon;

insert into public.contact_requests (name, email, phone, message)
values ('Visitante Anónimo', 'anonimo@test.com', '809-555-0001', 'Quiero más información sobre el plan Institucional.');

reset role;

-- ---------------------------------------------------------------
-- Caso 2: un usuario autenticado (therapist) también puede insertar.
-- ---------------------------------------------------------------
select tests.authenticate_as('contact_therapist');

insert into public.contact_requests (name, email, phone, message)
values ('Terapeuta Interesado', 'interesado@test.com', null, 'Somos una clínica de 12 terapeutas.');

select is(
  (select count(*)::int from public.contact_requests where email in ('anonimo@test.com', 'interesado@test.com')),
  0,
  'Caso 1/2: un therapist autenticado no puede leer las solicitudes que se acaban de insertar (RLS solo permite super_admin)'
);

-- ---------------------------------------------------------------
-- Caso 3: ni anon ni un therapist pueden leer las solicitudes.
-- ---------------------------------------------------------------
select tests.clear_authentication();
set local role anon;
select is(
  (select count(*)::int from public.contact_requests),
  0,
  'Caso 3a: un visitante anónimo no puede leer contact_requests'
);
reset role;

select tests.authenticate_as('contact_therapist');
select is(
  (select count(*)::int from public.contact_requests),
  0,
  'Caso 3b: un therapist autenticado no puede leer contact_requests'
);

-- ---------------------------------------------------------------
-- Caso 4: super_admin sí puede leer todas las solicitudes.
-- ---------------------------------------------------------------
select tests.authenticate_as('contact_super_admin');
select is(
  (select count(*)::int from public.contact_requests),
  2,
  'Caso 4: super_admin puede leer todas las solicitudes de contacto'
);

-- ---------------------------------------------------------------
-- Caso 5: un plan_interest fuera de los valores permitidos es rechazado.
-- ---------------------------------------------------------------
select tests.clear_authentication();
set local role anon;
select throws_ok(
  $$ insert into public.contact_requests (name, email, message, plan_interest)
     values ('Intruso', 'intruso@test.com', 'mensaje', 'plan_inventado') $$,
  '23514',
  null,
  'Caso 5: un plan_interest fuera de los valores permitidos es rechazado'
);

-- ---------------------------------------------------------------
-- Caso 6: un nombre en blanco es rechazado.
-- ---------------------------------------------------------------
select throws_ok(
  $$ insert into public.contact_requests (name, email, message)
     values ('   ', 'blanco@test.com', 'mensaje') $$,
  '23514',
  null,
  'Caso 6: un nombre en blanco (solo espacios) es rechazado'
);
reset role;

select * from finish();
rollback;
