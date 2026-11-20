-- Pacientes sin profesional: se asignan solos cuando corresponde
-- (ver 20260815000000_patient_auto_assign.sql).
begin;
select plan(7);

select tests.authenticate_as_service_role();

insert into public.organizations (name, plan_id)
select 'Org Auto', id from public.plans where code = 'institucional';
select id as org from public.organizations where name = 'Org Auto' \gset
insert into public.clinics (organization_id, name) values (:'org', 'Clinica Sola');
select id as c1 from public.clinics where name = 'Clinica Sola' and organization_id = :'org' \gset
insert into public.clinics (organization_id, name) values (:'org', 'Clinica Equipo');
select id as c2 from public.clinics where name = 'Clinica Equipo' and organization_id = :'org' \gset

select tests.create_supabase_user('psq1', 'psq1@test.com');
select tests.create_supabase_user('asi1', 'asi1@test.com');
select tests.create_supabase_user('ther2', 'ther2@test.com');
select tests.create_supabase_user('psq2', 'psq2@test.com');
select tests.create_supabase_user('asi2', 'asi2@test.com');
select tests.get_supabase_uid('psq1') as psq1 \gset
select tests.get_supabase_uid('asi1') as asi1 \gset
select tests.get_supabase_uid('ther2') as ther2 \gset
select tests.get_supabase_uid('psq2') as psq2 \gset
select tests.get_supabase_uid('asi2') as asi2 \gset

insert into public.profiles (id, organization_id, clinic_id, role, full_name, email, is_org_admin, must_change_password) values
  (:'psq1',  :'org', :'c1', 'psychiatrist', 'Psq Solo',    'psq1@test.com',  true,  false),
  (:'asi1',  :'org', :'c1', 'assistant',    'Asistente 1', 'asi1@test.com',  false, false),
  (:'ther2', :'org', :'c2', 'therapist',    'Terapeuta 2', 'ther2@test.com', false, false),
  (:'psq2',  :'org', :'c2', 'psychiatrist', 'Psq 2',       'psq2@test.com',  false, false),
  (:'asi2',  :'org', :'c2', 'assistant',    'Asistente 2', 'asi2@test.com',  false, false);

-- 1. El psiquiatra independiente crea sin indicar profesional: queda asignado a sí mismo.
select tests.authenticate_as('psq1');
insert into public.patients (organization_id, clinic_id, full_name, date_of_birth, category)
values (:'org', :'c1', 'P1 creado por psiquiatra', '1980-01-01', 'adult');
select tests.authenticate_as_service_role();
select is((select primary_therapist_id from public.patients where full_name = 'P1 creado por psiquiatra'),
          :'psq1'::uuid, '1. El profesional que crea queda autoasignado');

-- 2. La secretaria de un consultorio con un solo profesional: se asigna a él.
select tests.authenticate_as('asi1');
insert into public.patients (organization_id, clinic_id, full_name, date_of_birth, category)
values (:'org', :'c1', 'P2 creado por secretaria', '1985-01-01', 'adult');
select tests.authenticate_as_service_role();
select is((select primary_therapist_id from public.patients where full_name = 'P2 creado por secretaria'),
          :'psq1'::uuid, '2. Con un solo profesional en la clínica, la secretaria no deja pacientes huérfanos');

-- 3. Clínica con dos profesionales: sin asignar hasta que se elija.
select tests.authenticate_as('asi2');
insert into public.patients (organization_id, clinic_id, full_name, date_of_birth, category)
values (:'org', :'c2', 'P3 clinica con equipo', '1990-01-01', 'adult');
select tests.authenticate_as_service_role();
select is((select primary_therapist_id from public.patients where full_name = 'P3 clinica con equipo'),
          null::uuid, '3. Con varios profesionales queda sin asignar (se asigna desde la lista)');

-- 4. Una asignación explícita se respeta.
select tests.authenticate_as('asi2');
insert into public.patients (organization_id, clinic_id, full_name, date_of_birth, category, primary_therapist_id)
values (:'org', :'c2', 'P4 explicito', '1991-01-01', 'adult', :'psq2');
select tests.authenticate_as_service_role();
select is((select primary_therapist_id from public.patients where full_name = 'P4 explicito'),
          :'psq2'::uuid, '4. La asignación explícita no se cambia');

-- 5. Un psicólogo que crea en una clínica con equipo se autoasigna.
select tests.authenticate_as('ther2');
insert into public.patients (organization_id, clinic_id, full_name, date_of_birth, category)
values (:'org', :'c2', 'P5 creado por psicologo', '1992-01-01', 'adult');
select tests.authenticate_as_service_role();
select is((select primary_therapist_id from public.patients where full_name = 'P5 creado por psicologo'),
          :'ther2'::uuid, '5. El psicólogo que crea queda autoasignado');

-- 6. Un profesional inactivo no cuenta: si el otro se desactiva, queda UNO activo.
update public.profiles set active = false where id = :'psq2';
select tests.authenticate_as('asi2');
insert into public.patients (organization_id, clinic_id, full_name, date_of_birth, category)
values (:'org', :'c2', 'P6 tras desactivar', '1993-01-01', 'adult');
select tests.authenticate_as_service_role();
select is((select primary_therapist_id from public.patients where full_name = 'P6 tras desactivar'),
          :'ther2'::uuid, '6. Los profesionales inactivos no cuentan');

-- 7. Una secretaria puede asignar después un paciente sin profesional.
select tests.authenticate_as('asi2');
update public.patients set primary_therapist_id = :'ther2' where full_name = 'P3 clinica con equipo';
select tests.authenticate_as_service_role();
select is((select primary_therapist_id from public.patients where full_name = 'P3 clinica con equipo'),
          :'ther2'::uuid, '7. La secretaria puede asignar un paciente existente');

select * from finish();
rollback;
