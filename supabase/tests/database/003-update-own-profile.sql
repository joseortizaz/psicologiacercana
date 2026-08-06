-- Regresión: profiles_update (ver 20260101000000_baseline_schema.sql) solo
-- autoriza a org_admin/super_admin a editar filas de profiles, así que un
-- usuario normal no puede corregir su propio nombre/teléfono con un UPDATE
-- directo -- de ahí la función update_own_profile (ver
-- 20260804000000_add_update_own_profile_rpc.sql). Verifica que la función
-- sí funciona, que sigue auditada, y que un UPDATE directo (sin la función)
-- sigue bloqueado por RLS como antes.

begin;
select plan(6);

select tests.authenticate_as_service_role();

-- 2 terapeutas en la misma org: se le asigna el plan Institucional (sin
-- límites) para no acoplar este test a los límites de planes (ver
-- enforce_plan_limits en 20260805000000_subscription_plans.sql).
insert into public.organizations (name, plan_id)
select 'Org Ajustes - Test', id from public.plans where code = 'institucional';
select id as org_id from public.organizations where name = 'Org Ajustes - Test' \gset

insert into public.clinics (organization_id, name) values (:'org_id', 'Clínica Ajustes');
select id as clinic_id from public.clinics where organization_id = :'org_id' \gset

select tests.create_supabase_user('terapeuta_ajustes_1', 'terapeuta_ajustes_1@test.com');
select tests.create_supabase_user('terapeuta_ajustes_2', 'terapeuta_ajustes_2@test.com');

insert into public.profiles (id, organization_id, clinic_id, role, full_name, email, phone)
values (
  tests.get_supabase_uid('terapeuta_ajustes_1'), :'org_id', :'clinic_id',
  'therapist', 'Nombre Original', 'terapeuta_ajustes_1@test.com', '555-0000'
);

insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (
  tests.get_supabase_uid('terapeuta_ajustes_2'), :'org_id', :'clinic_id',
  'therapist', 'Terapeuta Ajustes 2', 'terapeuta_ajustes_2@test.com'
);

-- ---------------------------------------------------------------
-- Caso 1: un UPDATE directo sobre la propia fila sigue bloqueado por RLS
-- (confirma que el gap que cierra la función sí existía).
-- ---------------------------------------------------------------
select tests.authenticate_as('terapeuta_ajustes_1');

update public.profiles set full_name = 'Intento directo' where id = auth.uid();

select tests.authenticate_as_service_role();
select is(
  (select full_name from public.profiles where id = tests.get_supabase_uid('terapeuta_ajustes_1')),
  'Nombre Original',
  'Caso 1: un UPDATE directo de un usuario sobre su propia fila de profiles no tiene efecto (RLS lo filtra)'
);

-- ---------------------------------------------------------------
-- Caso 2: update_own_profile sí permite editar la propia fila.
-- ---------------------------------------------------------------
select tests.authenticate_as('terapeuta_ajustes_1');

select public.update_own_profile('Nombre Actualizado', '555-1234', 'LIC-001', 'Terapia cognitivo-conductual');

select tests.authenticate_as_service_role();
select results_eq(
  $$ select full_name, phone, license_number, specialty
     from public.profiles where id = tests.get_supabase_uid('terapeuta_ajustes_1') $$,
  $$ values ('Nombre Actualizado'::text, '555-1234'::text, 'LIC-001'::text, 'Terapia cognitivo-conductual'::text) $$,
  'Caso 2: update_own_profile actualiza full_name/phone/license_number/specialty de la propia fila'
);

-- ---------------------------------------------------------------
-- Caso 3: update_own_profile queda registrada en audit_logs igual que
-- cualquier otro UPDATE sobre profiles.
-- ---------------------------------------------------------------
select is(
  (select count(*)::int from audit_logs
     where table_name = 'profiles'
       and record_id = tests.get_supabase_uid('terapeuta_ajustes_1')
       and action = 'UPDATE'),
  1,
  'Caso 3: la actualización vía update_own_profile queda registrada en audit_logs'
);

-- ---------------------------------------------------------------
-- Caso 4: update_own_profile nunca toca la fila de otro usuario.
-- ---------------------------------------------------------------
select is(
  (select full_name from public.profiles where id = tests.get_supabase_uid('terapeuta_ajustes_2')),
  'Terapeuta Ajustes 2',
  'Caso 4: update_own_profile no modifica la fila de otro usuario'
);

-- ---------------------------------------------------------------
-- Caso 5: un nombre vacío es rechazado.
-- ---------------------------------------------------------------
select tests.authenticate_as('terapeuta_ajustes_2');
select throws_ok(
  $$ select public.update_own_profile('   ', null, null, null) $$,
  'P0001',
  'El nombre no puede estar vacío',
  'Caso 5: update_own_profile rechaza un nombre vacío o solo espacios'
);

-- ---------------------------------------------------------------
-- Caso 6: role/organization_id/clinic_id no son parámetros de la función
-- -- no hay superficie para que un usuario se autoasigne otro rol u
-- organización a través de ella.
-- ---------------------------------------------------------------
select is(
  (select role::text from public.profiles where id = tests.get_supabase_uid('terapeuta_ajustes_2')),
  'therapist',
  'Caso 6: el rol de la propia fila no cambia (update_own_profile no expone esa columna)'
);

select * from finish();
rollback;
