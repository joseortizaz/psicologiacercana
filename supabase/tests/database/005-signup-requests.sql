-- Autoregistro de terapeutas (ver 20260806000000_signup_requests.sql):
--   1. Un therapist no puede leer signup_requests (RLS: solo super_admin).
--   2. Un therapist no puede insertar en signup_requests directo (revoke;
--      el autoregistro real pasa por edge functions con service_role).
--   3. super_admin sí puede leer todas las solicitudes.
--   4. El bucket privado 'signup-documents' existe.
--   5. No se pueden crear dos solicitudes pendientes con el mismo correo
--      (índice único parcial).

begin;
select plan(5);

select tests.authenticate_as_service_role();

insert into public.organizations (name)
values ('Org Signup Requests - Test');
select id as org_id from public.organizations where name = 'Org Signup Requests - Test' \gset

insert into public.clinics (organization_id, name) values (:'org_id', 'Clínica Signup Requests');
select id as clinic_id from public.clinics where organization_id = :'org_id' \gset

select tests.create_supabase_user('signup_therapist', 'signup_therapist@test.com');
select tests.create_supabase_user('signup_super_admin', 'signup_super_admin@test.com');

insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (
  tests.get_supabase_uid('signup_therapist'), :'org_id', :'clinic_id',
  'therapist', 'Terapeuta Signup', 'signup_therapist@test.com'
);

insert into public.profiles (id, organization_id, role, full_name, email)
values (tests.get_supabase_uid('signup_super_admin'), null, 'super_admin', 'Super Admin Signup', 'signup_super_admin@test.com');

insert into public.signup_requests (
  full_name, email, license_number, clinic_name,
  id_document_path, credential_document_path, license_document_path
) values
  ('Solicitante Uno', 'solicitante1@test.com', 'EXQ-001', 'Consultorio Uno',
   'req-1/id-document', 'req-1/credential-document', 'req-1/license-document'),
  ('Solicitante Dos', 'solicitante2@test.com', 'EXQ-002', 'Consultorio Dos',
   'req-2/id-document', 'req-2/credential-document', 'req-2/license-document'),
  ('Solicitante Tres', 'solicitante3@test.com', 'EXQ-003', 'Consultorio Tres',
   'req-3/id-document', 'req-3/credential-document', 'req-3/license-document');

-- ---------------------------------------------------------------
-- Caso 1: un therapist no puede leer signup_requests.
-- ---------------------------------------------------------------
select tests.authenticate_as('signup_therapist');
select is(
  (select count(*)::int from public.signup_requests),
  0,
  'Caso 1: un therapist no puede leer filas de signup_requests (RLS solo permite super_admin)'
);

-- ---------------------------------------------------------------
-- Caso 2: un therapist no puede insertar en signup_requests directo.
-- ---------------------------------------------------------------
select throws_ok(
  $$ insert into public.signup_requests (
       full_name, email, license_number, clinic_name,
       id_document_path, credential_document_path, license_document_path
     ) values (
       'Intruso', 'intruso@test.com', 'EXQ-999', 'Consultorio Intruso',
       'x/id-document', 'x/credential-document', 'x/license-document'
     ) $$,
  '42501',
  null,
  'Caso 2: un therapist no puede insertar filas en signup_requests directo (revoke)'
);

-- ---------------------------------------------------------------
-- Caso 3: super_admin sí puede leer todas las solicitudes.
-- ---------------------------------------------------------------
select tests.authenticate_as('signup_super_admin');
select is(
  (select count(*)::int from public.signup_requests),
  3,
  'Caso 3: super_admin puede leer todas las solicitudes de registro'
);

-- ---------------------------------------------------------------
-- Caso 4: el bucket privado 'signup-documents' existe.
-- ---------------------------------------------------------------
select tests.authenticate_as_service_role();
select is(
  (select public from storage.buckets where id = 'signup-documents'),
  false,
  'Caso 4: el bucket signup-documents existe y es privado'
);

-- ---------------------------------------------------------------
-- Caso 5: no se pueden crear dos solicitudes pendientes con el mismo
-- correo (índice único parcial en status = 'pending').
-- ---------------------------------------------------------------
select throws_ok(
  $$ insert into public.signup_requests (
       full_name, email, license_number, clinic_name,
       id_document_path, credential_document_path, license_document_path
     ) values (
       'Solicitante Uno Duplicado', 'solicitante1@test.com', 'EXQ-001-B', 'Otro Consultorio',
       'req-1b/id-document', 'req-1b/credential-document', 'req-1b/license-document'
     ) $$,
  '23505',
  null,
  'Caso 5: no se puede crear una segunda solicitud pendiente con un correo que ya tiene una pendiente'
);

select * from finish();
rollback;
