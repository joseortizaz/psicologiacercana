-- Ciclo de vida de la prueba gratuita y contacto del solicitante
-- (ver 20260810000000_trial_lifecycle_and_signup_contact.sql):
--   1. Una organización creada sin indicar estado nace 'active', sin fechas
--      de prueba (las altas manuales del super_admin no son pruebas).
--   2. Una organización creada en 'trial' recibe trial_started_at = ahora y
--      trial_ends_at = exactamente 14 días después.
--   3. super_admin pasa una cuenta de plan a prueba: la ventana de 14 días
--      arranca en ese momento.
--   4. super_admin pasa una cuenta de prueba a plan: queda 'active' y el plan
--      elegido se conserva.
--   5. "Viceversa": al volver a prueba, la ventana REINICIA (no reutiliza las
--      fechas de la prueba anterior).
--   6. Si en ese mismo cambio el super_admin indica un trial_ends_at propio,
--      se respeta (por ejemplo, para regalar más días).
--   7. Un org_admin no puede cambiar subscription_status de su organización
--      (RLS: solo super_admin actualiza organizations).
--   8. signup_requests guarda phone y whatsapp_number.
--
-- Nota: dentro de una transacción now() es constante, así que los casos 5 y 6
-- fijan fechas viejas a propósito para poder distinguir "se reinició" de
-- "no cambió".

begin;
select plan(8);

select tests.authenticate_as_service_role();

-- ---------------------------------------------------------------
-- Caso 1: alta normal (sin estado explícito) = 'active', sin fechas.
-- ---------------------------------------------------------------
insert into public.organizations (name) values ('Org Trial - Activa por defecto');
select is(
  (select subscription_status::text || '|' || coalesce(trial_ends_at::text, 'null')
     from public.organizations where name = 'Org Trial - Activa por defecto'),
  'active|null',
  'Caso 1: una organización creada sin estado explícito nace active y sin fechas de prueba'
);

-- ---------------------------------------------------------------
-- Caso 2: alta directamente en 'trial' = ventana de 14 días exactos.
-- ---------------------------------------------------------------
insert into public.organizations (name, subscription_status)
values ('Org Trial - Nace en prueba', 'trial');
select is(
  (select (trial_started_at = now() and trial_ends_at = now() + interval '14 days')::text
     from public.organizations where name = 'Org Trial - Nace en prueba'),
  'true',
  'Caso 2: una organización creada en trial recibe trial_started_at = ahora y trial_ends_at = +14 días'
);

-- Org para los casos 3 a 7, con un org_admin (caso 7) y un super_admin.
insert into public.organizations (name) values ('Org Trial - Ciclo');
select id as org_id from public.organizations where name = 'Org Trial - Ciclo' \gset

select tests.create_supabase_user('trial_super_admin', 'trial_super_admin@test.com');
select tests.create_supabase_user('trial_org_admin', 'trial_org_admin@test.com');

insert into public.profiles (id, organization_id, role, full_name, email)
values (tests.get_supabase_uid('trial_super_admin'), null, 'super_admin', 'Super Admin Trial', 'trial_super_admin@test.com');

insert into public.profiles (id, organization_id, role, full_name, email)
values (tests.get_supabase_uid('trial_org_admin'), :'org_id', 'org_admin', 'Admin Trial', 'trial_org_admin@test.com');

-- ---------------------------------------------------------------
-- Caso 3: super_admin pasa de plan a prueba.
-- ---------------------------------------------------------------
select tests.authenticate_as('trial_super_admin');
update public.organizations set subscription_status = 'trial' where id = :'org_id';
select tests.authenticate_as_service_role();
select is(
  (select (subscription_status = 'trial'
           and trial_started_at = now()
           and trial_ends_at = now() + interval '14 days')::text
     from public.organizations where id = :'org_id'),
  'true',
  'Caso 3: pasar de plan a prueba abre una ventana de 14 días desde ese momento'
);

-- ---------------------------------------------------------------
-- Caso 4: super_admin pasa de prueba a plan (y elige el plan).
-- ---------------------------------------------------------------
select tests.authenticate_as('trial_super_admin');
update public.organizations
set subscription_status = 'active',
    plan_id = (select id from public.plans where code = 'duo_clinico')
where id = :'org_id';
select tests.authenticate_as_service_role();
select is(
  (select subscription_status::text || '|' || p.code
     from public.organizations o join public.plans p on p.id = o.plan_id
    where o.id = :'org_id'),
  'active|duo_clinico',
  'Caso 4: pasar de prueba a plan deja la cuenta active con el plan elegido'
);

-- ---------------------------------------------------------------
-- Caso 5: "viceversa" — volver a prueba reinicia la ventana.
-- Se fijan fechas viejas para distinguir "reinició" de "no cambió".
-- ---------------------------------------------------------------
update public.organizations
set trial_started_at = '2026-01-01T00:00:00Z',
    trial_ends_at = '2026-01-15T00:00:00Z'
where id = :'org_id';

select tests.authenticate_as('trial_super_admin');
update public.organizations set subscription_status = 'trial' where id = :'org_id';
select tests.authenticate_as_service_role();
select is(
  (select (trial_started_at = now() and trial_ends_at = now() + interval '14 days')::text
     from public.organizations where id = :'org_id'),
  'true',
  'Caso 5: volver de plan a prueba reinicia la ventana de 14 días (no reutiliza las fechas viejas)'
);

-- ---------------------------------------------------------------
-- Caso 6: si el super_admin indica su propio trial_ends_at al volver a
-- prueba, se respeta.
-- ---------------------------------------------------------------
select tests.authenticate_as('trial_super_admin');
update public.organizations set subscription_status = 'active' where id = :'org_id';
update public.organizations
set subscription_status = 'trial',
    trial_ends_at = now() + interval '30 days'
where id = :'org_id';
select tests.authenticate_as_service_role();
select is(
  (select (trial_ends_at = now() + interval '30 days')::text
     from public.organizations where id = :'org_id'),
  'true',
  'Caso 6: un trial_ends_at indicado explícitamente al volver a prueba se respeta'
);

-- ---------------------------------------------------------------
-- Caso 7: un org_admin no puede cambiar el estado de su propia cuenta.
-- ---------------------------------------------------------------
select tests.authenticate_as('trial_org_admin');
update public.organizations set subscription_status = 'active' where id = :'org_id';
select tests.authenticate_as_service_role();
select is(
  (select subscription_status::text from public.organizations where id = :'org_id'),
  'trial',
  'Caso 7: un org_admin no puede pasar su propia cuenta de prueba a plan (solo super_admin)'
);

-- ---------------------------------------------------------------
-- Caso 8: signup_requests guarda teléfono principal y WhatsApp.
-- ---------------------------------------------------------------
insert into public.signup_requests (
  full_name, email, phone, whatsapp_number, license_number, clinic_name,
  id_document_path, credential_document_path, license_document_path
) values (
  'Solicitante Contacto', 'solicitante.contacto@test.com', '+1 809 555 0101', '+1 829 555 0202',
  'EXQ-900', 'Consultorio Contacto',
  'req-c/id-document', 'req-c/credential-document', 'req-c/license-document'
);
select is(
  (select phone || '|' || whatsapp_number from public.signup_requests
    where email = 'solicitante.contacto@test.com'),
  '+1 809 555 0101|+1 829 555 0202',
  'Caso 8: signup_requests guarda el teléfono principal y el número de WhatsApp'
);

select * from finish();
rollback;
