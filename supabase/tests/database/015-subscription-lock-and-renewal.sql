-- Vencimiento de la suscripción: avisos y solo lectura
-- (ver 20260811000000_subscription_lock_and_renewal.sql).
--   Prueba:   aviso en los últimos 3 días; vencida = solo lectura.
--   Mensual:  aviso 7 días antes; vencida la fecha = advertencia (aún edita);
--             a los 10 días sin pago = solo lectura.
--   Anual:    aviso 30 días antes; a los 20 días sin pago = solo lectura.
--   Suspensión manual = solo lectura. Sin paid_until = nunca bloquea.
--   Solo lectura: se puede leer, pero no insertar/editar; se conservan el
--   cambio de contraseña y el WhatsApp. super_admin y service_role no se ven
--   afectados. register_subscription_payment reactiva la cuenta.
--
-- Nota: dentro de una transacción now() es constante; las fechas se fijan
-- siempre relativas a now().

begin;
select plan(30);

select tests.authenticate_as_service_role();

-- Ejecuta una sentencia y devuelve "ok" o el inicio del error (19 caracteres).
create function pg_temp.attempt(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return 'ok';
exception when others then
  return left(sqlerrm, 19);
end $$;
grant execute on function pg_temp.attempt(text) to public;

insert into public.organizations (name) values ('Org Lock');
select id as org_id from public.organizations where name = 'Org Lock' \gset

insert into public.clinics (organization_id, name) values (:'org_id', 'Clinica Lock');
select id as clinic_id from public.clinics where organization_id = :'org_id' \gset

select tests.create_supabase_user('lock_super', 'lock_super@test.com');
select tests.create_supabase_user('lock_admin', 'lock_admin@test.com');
insert into public.profiles (id, organization_id, role, full_name, email, must_change_password)
values (tests.get_supabase_uid('lock_super'), null, 'super_admin', 'Super Lock', 'lock_super@test.com', false);
insert into public.profiles (id, organization_id, role, full_name, email, must_change_password)
values (tests.get_supabase_uid('lock_admin'), :'org_id', 'org_admin', 'Admin Lock', 'lock_admin@test.com', true);
select tests.get_supabase_uid('lock_admin') as admin_id \gset

select format($f$insert into public.patients (organization_id, clinic_id, full_name, date_of_birth, category)
                 values (%L, %L, 'Paciente', '1990-01-01', 'adult')$f$, :'org_id', :'clinic_id') as patient_sql \gset

-- ---------------- PRUEBA ----------------
update public.organizations set subscription_status = 'trial', trial_started_at = now() - interval '4 days',
  trial_ends_at = now() + interval '10 days' where id = :'org_id';
select tests.authenticate_as('lock_admin');
select is((select state from public.my_org_access_state()), 'ok', '1. Prueba con 10 días restantes: sin aviso');
select is(pg_temp.attempt(:'patient_sql'), 'ok', '2. Prueba vigente: puede registrar datos');

select tests.authenticate_as_service_role();
update public.organizations set trial_ends_at = now() + interval '2 days' where id = :'org_id';
select tests.authenticate_as('lock_admin');
select is((select state || '/' || reason from public.my_org_access_state()), 'notice/trial_ending', '3. Últimos 3 días de prueba: aviso');
select is(pg_temp.attempt(:'patient_sql'), 'ok', '4. Con el aviso de prueba aún puede registrar');

select tests.authenticate_as_service_role();
update public.organizations set trial_ends_at = now() - interval '1 minute' where id = :'org_id';
select tests.authenticate_as('lock_admin');
select is((select state || '/' || reason from public.my_org_access_state()), 'locked/trial_expired', '5. Prueba vencida: estado locked');
select is(pg_temp.attempt(:'patient_sql'), 'CUENTA_SOLO_LECTURA', '6. Prueba vencida: no puede insertar');
select is(pg_temp.attempt(format('update public.clinics set name = %L where id = %L', 'Otro', :'clinic_id')),
          'CUENTA_SOLO_LECTURA', '7. Prueba vencida: no puede editar');
select is((select count(*)::int from public.patients), 2, '8. Prueba vencida: sigue pudiendo LEER lo ya registrado');
select is(pg_temp.attempt(format('update public.profiles set must_change_password = false where id = %L', :'admin_id')),
          'ok', '9. Bloqueado: aún puede completar el cambio de contraseña');
select is(pg_temp.attempt(format('select public.update_own_profile(%L, null, null, null, %L)', 'Admin Lock', '8095550000')),
          'ok', '10. Bloqueado: aún puede mantener su WhatsApp');
select is(pg_temp.attempt(format('select public.update_own_profile(%L, null, null, null, null)', 'Nombre Nuevo')),
          'CUENTA_SOLO_LECTURA', '11. Bloqueado: no puede cambiar su nombre');

select tests.authenticate_as('lock_super');
select is(pg_temp.attempt(format('update public.clinics set name = %L where id = %L', 'Editada por super', :'clinic_id')),
          'ok', '12. super_admin no se ve afectado por el bloqueo');
select tests.authenticate_as_service_role();
select is(pg_temp.attempt(:'patient_sql'), 'ok', '13. service_role (edge functions) no se ve afectado');

-- ---------------- MENSUAL ----------------
update public.organizations set subscription_status = 'active', billing_cycle = 'monthly',
  paid_until = now() + interval '5 days' where id = :'org_id';
select tests.authenticate_as('lock_admin');
select is((select state || '/' || reason from public.my_org_access_state()), 'notice/renewal_upcoming', '14. Mensual a 5 días del pago: aviso de renovación');

select tests.authenticate_as_service_role();
update public.organizations set paid_until = now() + interval '8 days' where id = :'org_id';
select tests.authenticate_as('lock_admin');
select is((select state from public.my_org_access_state()), 'ok', '15. Mensual a 8 días del pago: aún sin aviso (aviso desde 7)');

select tests.authenticate_as_service_role();
update public.organizations set paid_until = now() - interval '3 days' where id = :'org_id';
select tests.authenticate_as('lock_admin');
select is((select state || '/' || reason from public.my_org_access_state()), 'warning/payment_overdue', '16. Mensual vencido hace 3 días: advertencia');
select is(pg_temp.attempt(:'patient_sql'), 'ok', '17. Mensual con advertencia: aún puede registrar');

select tests.authenticate_as_service_role();
update public.organizations set paid_until = now() - interval '9 days' where id = :'org_id';
select tests.authenticate_as('lock_admin');
select is((select state from public.my_org_access_state()), 'warning', '18. Mensual vencido hace 9 días: sigue en advertencia');

select tests.authenticate_as_service_role();
update public.organizations set paid_until = now() - interval '11 days' where id = :'org_id';
select tests.authenticate_as('lock_admin');
select is((select state || '/' || reason from public.my_org_access_state()), 'locked/payment_overdue', '19. Mensual vencido hace 11 días: solo lectura');
select is(pg_temp.attempt(:'patient_sql'), 'CUENTA_SOLO_LECTURA', '20. Mensual bloqueado: no puede insertar');

-- ---------------- ANUAL ----------------
select tests.authenticate_as_service_role();
update public.organizations set billing_cycle = 'annual', paid_until = now() + interval '20 days' where id = :'org_id';
select tests.authenticate_as('lock_admin');
select is((select state || '/' || reason from public.my_org_access_state()), 'notice/renewal_upcoming', '21. Anual a 20 días del pago: aviso (ventana de 30)');

select tests.authenticate_as_service_role();
update public.organizations set paid_until = now() - interval '19 days' where id = :'org_id';
select tests.authenticate_as('lock_admin');
select is((select state from public.my_org_access_state()) || '/' || pg_temp.attempt(:'patient_sql'), 'warning/ok', '22. Anual vencido hace 19 días: advertencia y aún edita');

select tests.authenticate_as_service_role();
update public.organizations set paid_until = now() - interval '21 days' where id = :'org_id';
select tests.authenticate_as('lock_admin');
select is((select state from public.my_org_access_state()) || '/' || pg_temp.attempt(:'patient_sql'), 'locked/CUENTA_SOLO_LECTURA', '23. Anual vencido hace 21 días: solo lectura');

-- ---------------- SUSPENSIÓN / SIN FECHA ----------------
select tests.authenticate_as_service_role();
update public.organizations set paid_until = now() + interval '60 days', status = 'suspended' where id = :'org_id';
select tests.authenticate_as('lock_admin');
select is((select state || '/' || reason from public.my_org_access_state()), 'locked/suspended', '24. Cuenta suspendida por el super_admin: solo lectura');

select tests.authenticate_as_service_role();
update public.organizations set status = 'active', paid_until = null where id = :'org_id';
select tests.authenticate_as('lock_admin');
select is((select state from public.my_org_access_state()) || '/' || pg_temp.attempt(:'patient_sql'), 'ok/ok', '25. Con plan y sin paid_until nunca se bloquea por fecha');

-- ---------------- REGISTRO DE PAGO ----------------
select is(pg_temp.attempt(format('select public.register_subscription_payment(%L, 1000, %L)', :'org_id', 'monthly')),
          'Solo el superadmini', '26. Un org_admin no puede registrar pagos');

select tests.authenticate_as_service_role();
update public.organizations set billing_cycle = 'monthly', paid_until = now() - interval '30 days' where id = :'org_id';
select tests.authenticate_as('lock_super');
select public.register_subscription_payment(:'org_id'::uuid, 2500, 'monthly', 'DOP', null, null, null, 'Transferencia');
select tests.authenticate_as('lock_admin');
select is((select state from public.my_org_access_state()) || '/' || pg_temp.attempt(:'patient_sql'), 'ok/ok', '27. Registrar un pago reactiva una cuenta bloqueada');

select tests.authenticate_as_service_role();
select is((select (paid_until = now() + interval '1 month' and subscription_status = 'active')::text
             from public.organizations where id = :'org_id'),
          'true', '28. Pago con período vencido cuenta desde la fecha de pago (+1 mes)');
select is((select count(*)::int from public.subscription_payments where organization_id = :'org_id' and amount = 2500), 1,
          '29. El pago queda en el historial');

select tests.authenticate_as('lock_super');
select public.register_subscription_payment(:'org_id'::uuid, 2500, 'monthly');
select tests.authenticate_as_service_role();
select is((select (paid_until = now() + interval '2 months')::text from public.organizations where id = :'org_id'),
          'true', '30. Renovación anticipada suma al final del período vigente');

select * from finish();
rollback;
