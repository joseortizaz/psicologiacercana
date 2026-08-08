-- Registro de Evaluaciones -- policies de storage.objects para el bucket
-- privado 'evaluation-reports' (ver 20260808020000_evaluation_reports.sql,
-- sección "Storage"). Suite separada de 011-evaluation-reports.sql a
-- propósito -- las policies de storage.objects son un mecanismo distinto al
-- de la tabla evaluation_reports y no quedan cubiertas por esos tests.
--
-- Convención de ruta probada: {organization_id}/{clinical_record_id}/archivo
--
--   1. INSERT: solo therapist miembro activo del equipo del clinical_record
--      de la carpeta, y solo dentro de la carpeta de su propia organización.
--   2. SELECT: cualquier miembro activo del equipo (incluye psychiatrist,
--      solo lectura) + supervisor de la clínica; sin acceso para quien no es
--      miembro, assistant, ni org_admin (acceso auditado pendiente vía edge
--      function, fuera de esta suite).
--   3. UPDATE (reemplazar archivo): mismas reglas que INSERT.
--   4. DELETE: sin policy -- siempre bloqueado, en silencio (falla de
--      USING).

begin;
select plan(15);

select tests.authenticate_as_service_role();

insert into public.organizations (name, plan_id)
select 'Org Storage Evaluaciones - Test', id from public.plans where code = 'institucional';
select id as org_id from public.organizations where name = 'Org Storage Evaluaciones - Test' \gset
insert into public.clinics (organization_id, name) values (:'org_id', 'Clínica Storage Evaluaciones');
select id as clinic_id from public.clinics where organization_id = :'org_id' \gset

insert into public.organizations (name, plan_id)
select 'Org Storage Evaluaciones Otra - Test', id from public.plans where code = 'institucional';
select id as other_org_id from public.organizations where name = 'Org Storage Evaluaciones Otra - Test' \gset

select tests.create_supabase_user('evs_therapist', 'evs_therapist@test.com');
select tests.create_supabase_user('evs_psychiatrist', 'evs_psychiatrist@test.com');
select tests.create_supabase_user('evs_outsider', 'evs_outsider@test.com');
select tests.create_supabase_user('evs_supervisor', 'evs_supervisor@test.com');
select tests.create_supabase_user('evs_org_admin', 'evs_org_admin@test.com');
select tests.create_supabase_user('evs_assistant', 'evs_assistant@test.com');

insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('evs_therapist'), :'org_id', :'clinic_id', 'therapist', 'Terapeuta Storage', 'evs_therapist@test.com');
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('evs_psychiatrist'), :'org_id', :'clinic_id', 'psychiatrist', 'Psiquiatra Storage', 'evs_psychiatrist@test.com');
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('evs_outsider'), :'org_id', :'clinic_id', 'therapist', 'Terapeuta Fuera Storage', 'evs_outsider@test.com');
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('evs_supervisor'), :'org_id', :'clinic_id', 'supervisor', 'Supervisor Storage', 'evs_supervisor@test.com');
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('evs_org_admin'), :'org_id', null, 'org_admin', 'Admin Storage', 'evs_org_admin@test.com');
insert into public.profiles (id, organization_id, clinic_id, role, full_name, email)
values (tests.get_supabase_uid('evs_assistant'), :'org_id', :'clinic_id', 'assistant', 'Asistente Storage', 'evs_assistant@test.com');

insert into public.patients (organization_id, clinic_id, full_name, date_of_birth, category, primary_therapist_id)
select :'org_id', :'clinic_id', 'Paciente Storage', '1985-01-01', 'adult', tests.get_supabase_uid('evs_therapist');
select id as patient_id from public.patients where full_name = 'Paciente Storage' \gset

insert into public.clinical_records (organization_id, clinic_id, patient_id, primary_therapist_id, chief_complaint)
values (:'org_id', :'clinic_id', :'patient_id', tests.get_supabase_uid('evs_therapist'), 'Motivo storage');
select id as record_id from public.clinical_records where patient_id = :'patient_id' \gset

select tests.authenticate_as('evs_therapist');
insert into public.clinical_record_team_members (clinical_record_id, clinician_id)
values (:'record_id', tests.get_supabase_uid('evs_psychiatrist'));

-- Rutas usadas en los casos de abajo.
select (:'org_id' || '/' || :'record_id' || '/informe.pdf') as obj_path \gset
select (:'other_org_id' || '/' || :'record_id' || '/informe-otra-org.pdf') as wrong_org_path \gset

-- ---------------------------------------------------------------
-- Caso 1: un therapist que NO es miembro del equipo no puede subir el
-- archivo a la carpeta de ese clinical_record.
-- ---------------------------------------------------------------
select tests.authenticate_as('evs_outsider');
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('evaluation-reports', '%s') $$, :'obj_path'),
  '42501',
  null,
  'Caso 1: un therapist que no es miembro del equipo no puede subir el archivo'
);

-- ---------------------------------------------------------------
-- Caso 2: un psychiatrist miembro del equipo tampoco puede subir el archivo
-- (INSERT restringido a therapist, igual que la fila de la tabla).
-- ---------------------------------------------------------------
select tests.authenticate_as('evs_psychiatrist');
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('evaluation-reports', '%s') $$, :'obj_path'),
  '42501',
  null,
  'Caso 2: un psychiatrist miembro del equipo no puede subir el archivo (solo therapist)'
);

-- ---------------------------------------------------------------
-- Caso 3: un assistant no puede subir el archivo.
-- ---------------------------------------------------------------
select tests.authenticate_as('evs_assistant');
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('evaluation-reports', '%s') $$, :'obj_path'),
  '42501',
  null,
  'Caso 3: un assistant no puede subir el archivo'
);

-- ---------------------------------------------------------------
-- Caso 4: el therapist miembro del equipo no puede subir un archivo bajo el
-- prefijo de OTRA organización, aunque el clinical_record_id sea el mismo
-- (aislamiento de tenant a nivel de ruta).
-- ---------------------------------------------------------------
select tests.authenticate_as('evs_therapist');
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('evaluation-reports', '%s') $$, :'wrong_org_path'),
  '42501',
  null,
  'Caso 4: no se puede subir un archivo bajo el prefijo de otra organización'
);

-- ---------------------------------------------------------------
-- Caso 5: el therapist miembro del equipo SÍ puede subir el archivo a la
-- ruta correcta.
-- ---------------------------------------------------------------
insert into storage.objects (bucket_id, name) values ('evaluation-reports', :'obj_path');

select tests.authenticate_as_service_role();
select is(
  (select count(*)::int from storage.objects where bucket_id = 'evaluation-reports' and name = :'obj_path'),
  1,
  'Caso 5: un therapist miembro activo del equipo sí puede subir el archivo a la ruta correcta'
);

-- ---------------------------------------------------------------
-- Caso 6: el propio therapist que subió el archivo puede leerlo.
-- ---------------------------------------------------------------
select tests.authenticate_as('evs_therapist');
select is(
  (select count(*)::int from storage.objects where bucket_id = 'evaluation-reports' and name = :'obj_path'),
  1,
  'Caso 6: el therapist que subió el archivo puede leerlo'
);

-- ---------------------------------------------------------------
-- Caso 7: el psychiatrist miembro del equipo (solo lectura) también puede
-- leer el archivo.
-- ---------------------------------------------------------------
select tests.authenticate_as('evs_psychiatrist');
select is(
  (select count(*)::int from storage.objects where bucket_id = 'evaluation-reports' and name = :'obj_path'),
  1,
  'Caso 7: un psychiatrist miembro del equipo puede leer el archivo aunque no pueda subirlo'
);

-- ---------------------------------------------------------------
-- Caso 8: quien no es miembro del equipo no puede leer el archivo.
-- ---------------------------------------------------------------
select tests.authenticate_as('evs_outsider');
select is(
  (select count(*)::int from storage.objects where bucket_id = 'evaluation-reports' and name = :'obj_path'),
  0,
  'Caso 8: un clínico que no es miembro del equipo no puede leer el archivo'
);

-- ---------------------------------------------------------------
-- Caso 9: supervisor puede leer el archivo a nivel de clínica.
-- ---------------------------------------------------------------
select tests.authenticate_as('evs_supervisor');
select is(
  (select count(*)::int from storage.objects where bucket_id = 'evaluation-reports' and name = :'obj_path'),
  1,
  'Caso 9: supervisor puede leer el archivo sin ser miembro del equipo'
);

-- ---------------------------------------------------------------
-- Caso 10: assistant no puede leer el archivo.
-- ---------------------------------------------------------------
select tests.authenticate_as('evs_assistant');
select is(
  (select count(*)::int from storage.objects where bucket_id = 'evaluation-reports' and name = :'obj_path'),
  0,
  'Caso 10: un assistant no puede leer el archivo bajo ninguna modalidad'
);

-- ---------------------------------------------------------------
-- Caso 11: org_admin no tiene lectura directa del archivo (mismo patrón que
-- la fila de la tabla -- el acceso auditado se resuelve con una edge
-- function que genera un signed URL, fuera del alcance de esta suite).
-- ---------------------------------------------------------------
select tests.authenticate_as('evs_org_admin');
select is(
  (select count(*)::int from storage.objects where bucket_id = 'evaluation-reports' and name = :'obj_path'),
  0,
  'Caso 11: org_admin no tiene policy de SELECT directa sobre el archivo'
);

-- ---------------------------------------------------------------
-- Caso 12: quien no es miembro del equipo no puede reemplazar (UPDATE) el
-- archivo -- falla en silencio (0 filas), no lanza excepción.
-- ---------------------------------------------------------------
select tests.authenticate_as('evs_outsider');
update storage.objects set metadata = '{"reemplazado":"outsider"}'::jsonb
  where bucket_id = 'evaluation-reports' and name = :'obj_path';

select tests.authenticate_as_service_role();
select is(
  (select metadata ->> 'reemplazado' from storage.objects where bucket_id = 'evaluation-reports' and name = :'obj_path'),
  null::text,
  'Caso 12: quien no es miembro del equipo no puede reemplazar el archivo -- UPDATE no afecta ninguna fila'
);

-- ---------------------------------------------------------------
-- Caso 12b: el propio therapist miembro del equipo SÍ puede reemplazar
-- (UPDATE) el archivo.
-- ---------------------------------------------------------------
select tests.authenticate_as('evs_therapist');
update storage.objects set metadata = '{"reemplazado":"therapist"}'::jsonb
  where bucket_id = 'evaluation-reports' and name = :'obj_path';

select tests.authenticate_as_service_role();
select is(
  (select metadata ->> 'reemplazado' from storage.objects where bucket_id = 'evaluation-reports' and name = :'obj_path'),
  'therapist',
  'Caso 12b: un therapist miembro activo del equipo sí puede reemplazar el archivo'
);

-- ---------------------------------------------------------------
-- Caso 13: DELETE siempre bloqueado. Storage instala su propio trigger
-- storage.protect_delete() sobre storage.objects, que lanza una excepción
-- ante CUALQUIER DELETE directo (sin pasar por la Storage API) -- ni
-- siquiera llega a evaluarse la falta de policy de DELETE de esta suite.
-- El trigger relanza el error con SQLSTATE 42501 (insufficient_privilege),
-- no P0001 (confirmado en CI) -- ver mensaje: "Direct deletion from storage
-- tables is not allowed. Use the Storage API instead."
-- ---------------------------------------------------------------
select tests.authenticate_as('evs_therapist');
select throws_ok(
  format(
    $$ delete from storage.objects where bucket_id = 'evaluation-reports' and name = '%s' $$,
    :'obj_path'
  ),
  '42501',
  null,
  'Caso 13: DELETE está siempre bloqueado, incluso para quien subió el archivo (storage.protect_delete())'
);

select tests.authenticate_as_service_role();
select is(
  (select count(*)::int from storage.objects where bucket_id = 'evaluation-reports' and name = :'obj_path'),
  1,
  'Caso 13b: el archivo sigue existiendo tras el intento de DELETE'
);

select * from finish();
rollback;
