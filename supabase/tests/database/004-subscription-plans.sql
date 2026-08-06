-- Planes de suscripción (ver 20260805000000_subscription_plans.sql):
--   1-4. enforce_plan_limits bloquea altas de personal por encima del
--        límite del plan de la organización, permite hasta el límite,
--        también se aplica al reactivar un perfil inactivo, y no aplica
--        límite en un plan personalizado (max_* = null).
--   5-8. RLS de plans: cualquier autenticado puede leer; solo super_admin
--        puede insertar/actualizar/eliminar.

begin;
select plan(8);

select tests.authenticate_as_service_role();

-- Org con el plan Esencial (1 terapeuta, 1 org_admin, 0 asistentes, 0
-- supervisores) — ver seed en 20260805000000_subscription_plans.sql.
insert into public.organizations (name, plan_id)
select 'Org Planes Esencial - Test', id from public.plans where code = 'esencial';
select id as org_esencial_id from public.organizations where name = 'Org Planes Esencial - Test' \gset

insert into public.clinics (organization_id, name) values (:'org_esencial_id', 'Clínica Planes');
select id as clinic_id from public.clinics where organization_id = :'org_esencial_id' \gset

-- Org con el plan Institucional (sin límites) para el caso 4.
insert into public.organizations (name, plan_id)
select 'Org Planes Institucional - Test', id from public.plans where code = 'institucional';
select id as org_institucional_id from public.organizations where name = 'Org Planes Institucional - Test' \gset

insert into public.clinics (organization_id, name) values (:'org_institucional_id', 'Clínica Institucional');
select id as clinic_institucional_id from public.clinics where organization_id = :'org_institucional_id' \gset

select tests.create_supabase_user('plan_terapeuta_1', 'plan_terapeuta_1@test.com');
select tests.create_supabase_user('plan_terapeuta_2', 'plan_terapeuta_2@test.com');
select tests.create_supabase_user('plan_terapeuta_inactivo', 'plan_terapeuta_inactivo@test.com');
select tests.create_supabase_user('plan_super_admin', 'plan_super_admin@test.com');
select tests.create_supabase_user('plan_org_admin', 'plan_org_admin@test.com');

insert into public.profiles (id, organization_id, role, full_name, email)
values (tests.get_supabase_uid('plan_super_admin'), null, 'super_admin', 'Super Admin Planes', 'plan_super_admin@test.com');

insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (
  tests.get_supabase_uid('plan_org_admin'), :'org_esencial_id', null,
  'org_admin', 'Org Admin Planes', 'plan_org_admin@test.com'
);

-- ---------------------------------------------------------------
-- Caso 1: el primer terapeuta (dentro del límite del plan Esencial) se
-- puede insertar sin problema.
-- ---------------------------------------------------------------
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (
  tests.get_supabase_uid('plan_terapeuta_1'), :'org_esencial_id', :'clinic_id',
  'therapist', 'Terapeuta Plan 1', 'plan_terapeuta_1@test.com'
);
select is(
  (select count(*)::int from public.profiles
     where organization_id = :'org_esencial_id' and role = 'therapist' and active),
  1,
  'Caso 1: el primer terapeuta se inserta sin problema (dentro del límite del plan Esencial)'
);

-- ---------------------------------------------------------------
-- Caso 2: un segundo terapeuta activo en la misma org excede el límite
-- (max_therapists = 1 en el plan Esencial) y se bloquea.
-- ---------------------------------------------------------------
select throws_ok(
  format(
    $$ insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
       values ('%s', '%s', '%s', 'therapist', 'Terapeuta Plan 2', 'plan_terapeuta_2@test.com') $$,
    tests.get_supabase_uid('plan_terapeuta_2'), :'org_esencial_id', :'clinic_id'
  ),
  'P0001',
  'El plan actual permite un máximo de 1 terapeutas activos por organización. Actualice el plan para agregar más.',
  'Caso 2: un segundo terapeuta activo excede el límite del plan Esencial y se bloquea'
);

-- ---------------------------------------------------------------
-- Caso 3: reactivar un perfil inactivo también se valida contra el límite
-- (no solo el INSERT inicial).
-- ---------------------------------------------------------------
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email, active)
values (
  tests.get_supabase_uid('plan_terapeuta_inactivo'), :'org_esencial_id', :'clinic_id',
  'therapist', 'Terapeuta Inactivo', 'plan_terapeuta_inactivo@test.com', false
);
select throws_ok(
  format(
    $$ update public.profiles set active = true where id = '%s' $$,
    tests.get_supabase_uid('plan_terapeuta_inactivo')
  ),
  'P0001',
  'El plan actual permite un máximo de 1 terapeutas activos por organización. Actualice el plan para agregar más.',
  'Caso 3: reactivar un terapeuta también se valida contra el límite del plan (no solo el alta inicial)'
);

-- ---------------------------------------------------------------
-- Caso 4: un plan personalizado (Institucional, max_therapists = null) no
-- impone límite.
-- ---------------------------------------------------------------
select tests.create_supabase_user('plan_terapeuta_inst_1', 'plan_terapeuta_inst_1@test.com');
select tests.create_supabase_user('plan_terapeuta_inst_2', 'plan_terapeuta_inst_2@test.com');

insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (
  tests.get_supabase_uid('plan_terapeuta_inst_1'), :'org_institucional_id', :'clinic_institucional_id',
  'therapist', 'Terapeuta Institucional 1', 'plan_terapeuta_inst_1@test.com'
);
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (
  tests.get_supabase_uid('plan_terapeuta_inst_2'), :'org_institucional_id', :'clinic_institucional_id',
  'therapist', 'Terapeuta Institucional 2', 'plan_terapeuta_inst_2@test.com'
);
select is(
  (select count(*)::int from public.profiles
     where organization_id = :'org_institucional_id' and role = 'therapist' and active),
  2,
  'Caso 4: un plan personalizado (Institucional) no impone límite de terapeutas'
);

-- ---------------------------------------------------------------
-- Caso 5: cualquier usuario autenticado puede leer la tabla plans.
-- ---------------------------------------------------------------
select tests.authenticate_as('plan_terapeuta_1');
select ok(
  (select count(*)::int from public.plans) >= 5,
  'Caso 5: un usuario autenticado (therapist) puede leer la tabla plans'
);

-- ---------------------------------------------------------------
-- Caso 6: org_admin no puede crear planes nuevos.
-- ---------------------------------------------------------------
select tests.authenticate_as('plan_org_admin');
select throws_ok(
  $$ insert into public.plans (code, name) values ('plan_pirata', 'Plan Pirata') $$,
  '42501',
  null,
  'Caso 6: org_admin no puede insertar filas en la tabla plans'
);

-- ---------------------------------------------------------------
-- Caso 7: org_admin no puede modificar un plan existente.
-- ---------------------------------------------------------------
select throws_ok(
  $$ update public.plans set monthly_price = 1 where code = 'esencial' $$,
  '42501',
  null,
  'Caso 7: org_admin no puede actualizar filas de la tabla plans'
);

-- ---------------------------------------------------------------
-- Caso 8: super_admin sí puede crear un plan nuevo.
-- ---------------------------------------------------------------
select tests.authenticate_as('plan_super_admin');
insert into public.plans (code, name, tagline, monthly_price, max_therapists, max_org_admins, max_assistants, max_supervisors)
values ('plan_prueba_super_admin', 'Plan de prueba', 'Creado por super_admin en test', 100, 1, 1, 0, 0);

select tests.authenticate_as_service_role();
select is(
  (select count(*)::int from public.plans where code = 'plan_prueba_super_admin'),
  1,
  'Caso 8: super_admin sí puede insertar planes nuevos'
);

select * from finish();
rollback;
