-- Profesionales independientes + credenciales administradas -- ver
-- plan-independientes-y-credenciales-cercana.md, secciones A.1 y B.1.
--   1. is_org_admin_only_for_clinical_or_admin_roles: rechaza is_org_admin
--      en assistant/supervisor, lo permite en therapist/psychiatrist/
--      org_admin/super_admin.
--   2. is_org_admin_or_super(): un therapist con is_org_admin = true obtiene
--      exactamente el mismo acceso administrativo que un org_admin
--      (profiles_insert/profiles_update), y SIGUE teniendo su acceso
--      clínico normal de therapist (no se toca ninguna policy clínica).
--   3. mark_password_changed(): el propio usuario limpia su bandera
--      must_change_password, y solo la propia.

begin;
select plan(8);

select tests.authenticate_as_service_role();

insert into public.organizations (name, plan_id)
select 'Org Independiente - Test', id from public.plans where code = 'institucional';
select id as org_id from public.organizations where name = 'Org Independiente - Test' \gset
insert into public.clinics (organization_id, name) values (:'org_id', 'Consultorio Propio');
select id as clinic_id from public.clinics where organization_id = :'org_id' \gset

select tests.create_supabase_user('indep_therapist', 'indep_therapist@test.com');
select tests.create_supabase_user('plain_therapist', 'plain_therapist@test.com');
select tests.create_supabase_user('cred_assistant', 'cred_assistant@test.com');

-- ---------------------------------------------------------------
-- Caso 1: is_org_admin = true en un rol no clínico/admin (assistant) viola
-- el constraint.
-- ---------------------------------------------------------------
select throws_ok(
  format(
    $$ insert into public.profiles (id, organization_id, clinic_id, role, full_name, email, is_org_admin)
       values ('%s', '%s', '%s', 'assistant', 'Asistente inválida', 'invalido-assistant@test.com', true) $$,
    tests.get_supabase_uid('cred_assistant'), :'org_id', :'clinic_id'
  ),
  '23514',
  null,
  'Caso 1: is_org_admin = true en un assistant viola is_org_admin_only_for_clinical_or_admin_roles'
);

-- Perfil real del assistant (sin is_org_admin) para el Caso 6.
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('cred_assistant'), :'org_id', :'clinic_id', 'assistant', 'Asistente Credenciales', 'cred_assistant@test.com');

-- ---------------------------------------------------------------
-- Caso 2: is_org_admin = true en un therapist (profesional independiente)
-- SÍ es válido.
-- ---------------------------------------------------------------
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email, is_org_admin)
values (tests.get_supabase_uid('indep_therapist'), :'org_id', :'clinic_id', 'therapist', 'Terapeuta Independiente', 'indep_therapist@test.com', true);

select isnt_empty(
  format($$ select 1 from public.profiles where id = '%s' and is_org_admin $$, tests.get_supabase_uid('indep_therapist')),
  'Caso 2: therapist con is_org_admin = true se inserta correctamente'
);

insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('plain_therapist'), :'org_id', :'clinic_id', 'therapist', 'Terapeuta Normal', 'plain_therapist@test.com');

-- ---------------------------------------------------------------
-- Caso 3: el therapist independiente (is_org_admin = true) tiene acceso
-- administrativo -- puede invitar (INSERT en profiles), igual que un
-- org_admin.
-- ---------------------------------------------------------------
select tests.authenticate_as('indep_therapist');
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (extensions.uuid_generate_v4(), :'org_id', :'clinic_id', 'assistant', 'Asistente Contratada', 'asistente-contratada@test.com');

select tests.authenticate_as_service_role();
select isnt_empty(
  $$ select 1 from public.profiles where full_name = 'Asistente Contratada' $$,
  'Caso 3: un therapist con is_org_admin = true puede insertar perfiles (capacidad administrativa)'
);

-- ---------------------------------------------------------------
-- Caso 4: un therapist normal (is_org_admin = false) NO tiene esa capacidad
-- administrativa -- el mismo INSERT falla.
-- ---------------------------------------------------------------
select tests.authenticate_as('plain_therapist');
select throws_ok(
  format(
    $$ insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
       values ('%s', '%s', '%s', 'assistant', 'Asistente Rechazada', 'asistente-rechazada@test.com') $$,
    extensions.uuid_generate_v4(), :'org_id', :'clinic_id'
  ),
  '42501',
  null,
  'Caso 4: un therapist sin is_org_admin no puede insertar perfiles'
);

-- ---------------------------------------------------------------
-- Caso 5: el therapist independiente conserva su acceso clínico normal
-- (patients) -- is_org_admin no le quita ni le altera el acceso clínico.
-- ---------------------------------------------------------------
insert into public.patients (organization_id, clinic_id, full_name, date_of_birth, category, primary_therapist_id)
select :'org_id', :'clinic_id', 'Paciente Independiente', '1992-01-01', 'adult', tests.get_supabase_uid('indep_therapist');

select tests.authenticate_as('indep_therapist');
select is(
  (select count(*)::int from public.patients where full_name = 'Paciente Independiente'),
  1,
  'Caso 5: el therapist independiente (is_org_admin = true) sí ve a sus propios pacientes'
);

-- ---------------------------------------------------------------
-- Caso 6: must_change_password / mark_password_changed() -- el propio
-- usuario limpia su bandera.
-- ---------------------------------------------------------------
select tests.authenticate_as_service_role();
update public.profiles set must_change_password = true where id = tests.get_supabase_uid('cred_assistant');

select tests.authenticate_as('cred_assistant');
select mark_password_changed();

select tests.authenticate_as_service_role();
select is(
  (select must_change_password from public.profiles where id = tests.get_supabase_uid('cred_assistant')),
  false,
  'Caso 6: mark_password_changed() limpia must_change_password de la propia fila'
);

-- ---------------------------------------------------------------
-- Caso 7: mark_password_changed() no puede limpiar la bandera de OTRO
-- usuario -- solo opera sobre auth.uid().
-- ---------------------------------------------------------------
update public.profiles set must_change_password = true where id = tests.get_supabase_uid('plain_therapist');

select tests.authenticate_as('cred_assistant');
select mark_password_changed();

select tests.authenticate_as_service_role();
select is(
  (select must_change_password from public.profiles where id = tests.get_supabase_uid('plain_therapist')),
  true,
  'Caso 7: mark_password_changed() no afecta la fila de otro usuario'
);

-- ---------------------------------------------------------------
-- Caso 8: profiles_update sigue exigiendo capacidad administrativa para un
-- UPDATE directo -- un therapist SIN is_org_admin no puede apagar el
-- must_change_password de otra persona con un UPDATE normal (RLS lo filtra
-- en silencio, mismo patrón que el Caso 3 de 001-multi-tenant-isolation).
-- ---------------------------------------------------------------
update public.profiles set must_change_password = true where id = tests.get_supabase_uid('cred_assistant');

select tests.authenticate_as('plain_therapist');
update public.profiles set must_change_password = false where id = tests.get_supabase_uid('cred_assistant');

select tests.authenticate_as_service_role();
select is(
  (select must_change_password from public.profiles where id = tests.get_supabase_uid('cred_assistant')),
  true,
  'Caso 8: un therapist sin is_org_admin no puede apagar must_change_password de otro usuario vía UPDATE directo'
);

select * from finish();
rollback;
