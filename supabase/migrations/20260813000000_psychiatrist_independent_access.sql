-- ============================================================================
-- Psiquiatra independiente: puede trabajar sin depender de otro profesional
-- ============================================================================
-- Hasta ahora el rol 'psychiatrist' solo podía unirse al expediente de un
-- paciente creado por otro (terapeuta o asistente): las políticas de
-- patients, appointments y consents solo contemplaban assistant / therapist /
-- org_admin. Un psiquiatra que se registra solo (con su propia clínica) no
-- podía dar de alta pacientes ni citas.
--
-- Esta migración:
--   1. Permite al psiquiatra crear/editar pacientes y consentimientos de su
--      clínica (mismas reglas que el terapeuta).
--   2. Permite al psiquiatra crear/editar SUS citas (therapist_id = él), igual
--      que el terapeuta.
--   3. Hace que el psiquiatra cuente dentro de max_therapists, junto con los
--      terapeutas: son "profesionales clínicos". Así el plan Esencial
--      (1 profesional) sigue siendo 1 profesional, sea psicólogo o psiquiatra.
--
-- No se tocan las políticas de lectura: patients/consents ya se leen por
-- organización y clínica, y appointments_select ya incluye
-- "therapist_id = auth.uid()", que cubre al psiquiatra.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. patients
-- ----------------------------------------------------------------------------
drop policy if exists patients_insert on public.patients;
create policy patients_insert on public.patients
  for insert with check (
    organization_id = auth_organization_id()
    and auth_role() = any (array['assistant','therapist','psychiatrist','org_admin']::user_role[])
    and (auth_clinic_id() is null or clinic_id = auth_clinic_id())
  );

drop policy if exists patients_update on public.patients;
create policy patients_update on public.patients
  for update using (
    organization_id = auth_organization_id()
    and auth_role() = any (array['assistant','therapist','psychiatrist','org_admin']::user_role[])
    and (auth_clinic_id() is null or clinic_id = auth_clinic_id())
  );

-- ----------------------------------------------------------------------------
-- 2. appointments
-- ----------------------------------------------------------------------------
drop policy if exists appointments_update on public.appointments;
create policy appointments_update on public.appointments
  for update using (
    organization_id = auth_organization_id()
    and (
      (auth_role() = any (array['assistant','org_admin']::user_role[]) and (auth_clinic_id() is null or clinic_id = auth_clinic_id()))
      or (auth_role() = any (array['therapist','psychiatrist']::user_role[]) and therapist_id = auth.uid())
    )
  );

drop policy if exists appointments_insert on public.appointments;
create policy appointments_insert on public.appointments
  for insert with check (
    organization_id = auth_organization_id()
    and (
      (auth_role() = any (array['assistant','org_admin']::user_role[]) and (auth_clinic_id() is null or clinic_id = auth_clinic_id()))
      or (auth_role() = any (array['therapist','psychiatrist']::user_role[]) and therapist_id = auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- 3. consents
-- ----------------------------------------------------------------------------
drop policy if exists consents_insert on public.consents;
create policy consents_insert on public.consents
  for insert with check (
    organization_id = auth_organization_id()
    and auth_role() = any (array['assistant','therapist','psychiatrist','org_admin']::user_role[])
    and (auth_clinic_id() is null or clinic_id = auth_clinic_id())
  );

drop policy if exists consents_update on public.consents;
create policy consents_update on public.consents
  for update using (
    organization_id = auth_organization_id()
    and auth_role() = any (array['assistant','therapist','psychiatrist','org_admin']::user_role[])
    and (auth_clinic_id() is null or clinic_id = auth_clinic_id())
  );

-- ----------------------------------------------------------------------------
-- 4. Límite de plan: terapeutas + psiquiatras = profesionales clínicos
-- ----------------------------------------------------------------------------
-- Igual que antes (20260805000000), con dos cambios: 'psychiatrist' pasa a
-- estar contemplado y comparte el cupo max_therapists con 'therapist'.
-- Solo se evalúan altas, reactivaciones y cambios de rol/organización; las
-- organizaciones que ya tengan más profesionales que su cupo no se bloquean
-- retroactivamente, pero no podrán sumar más.
create or replace function public.enforce_plan_limits()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_plan_id uuid;
  v_max integer;
  v_count integer;
  v_role_label text;
  v_roles user_role[];
begin
  -- Solo aplica a filas activas con un rol contemplado por los planes.
  if NEW.active is not true then
    return NEW;
  end if;
  if NEW.role not in ('org_admin','therapist','psychiatrist','assistant','supervisor') then
    return NEW;
  end if;

  -- En UPDATE, solo re-evaluar si algo relevante para el conteo cambió
  -- (evita que update_own_profile u otros UPDATE inocuos disparen el check).
  if TG_OP = 'UPDATE'
    and OLD.role = NEW.role
    and OLD.organization_id = NEW.organization_id
    and OLD.active = NEW.active
  then
    return NEW;
  end if;

  select plan_id into v_plan_id from public.organizations where id = NEW.organization_id;
  if v_plan_id is null then
    return NEW;
  end if;

  if NEW.role in ('therapist','psychiatrist') then
    select max_therapists into v_max from public.plans where id = v_plan_id;
    v_role_label := 'profesionales clínicos (psicólogos y psiquiatras)';
    v_roles := array['therapist','psychiatrist']::user_role[];
  elsif NEW.role = 'org_admin' then
    select max_org_admins into v_max from public.plans where id = v_plan_id;
    v_role_label := 'administradores';
    v_roles := array['org_admin']::user_role[];
  elsif NEW.role = 'assistant' then
    select max_assistants into v_max from public.plans where id = v_plan_id;
    v_role_label := 'asistentes administrativas';
    v_roles := array['assistant']::user_role[];
  elsif NEW.role = 'supervisor' then
    select max_supervisors into v_max from public.plans where id = v_plan_id;
    v_role_label := 'supervisores clínicos';
    v_roles := array['supervisor']::user_role[];
  end if;

  -- NULL = sin límite (plan personalizado / institucional).
  if v_max is null then
    return NEW;
  end if;

  select count(*) into v_count
  from public.profiles
  where organization_id = NEW.organization_id
    and role = any (v_roles)
    and active = true
    and id <> coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_count >= v_max then
    raise exception 'El plan actual permite un máximo de % % activos por organización. Actualice el plan para agregar más.', v_max, v_role_label;
  end if;

  return NEW;
end;
$$;
