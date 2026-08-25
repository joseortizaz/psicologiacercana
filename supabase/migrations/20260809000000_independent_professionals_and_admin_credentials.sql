-- ============================================================================
-- Profesionales independientes + credenciales administradas
-- (ver plan-independientes-y-credenciales-cercana.md, secciones A.1 y B.1).
-- ============================================================================
-- Contenido de este archivo, en orden (orden de trabajo sugerido, punto 1):
--   1. profiles.is_org_admin: bandera administrativa independiente del rol,
--      con su constraint de sentido común.
--   2. is_org_admin_or_super(): único cambio, efecto propagado a todas las
--      policies que ya la usan (clinics, profiles, consent_templates, y la
--      lectura auditada de org_admin sobre datos clínicos).
--   3. profiles.must_change_password + mark_password_changed(): credenciales
--      generadas por el administrador, cambio obligatorio en primer login.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. is_org_admin: capacidad administrativa desacoplada del rol clínico
-- ----------------------------------------------------------------------------
alter table public.profiles add column if not exists is_org_admin boolean not null default false;

-- Guarda de sentido común: solo tiene sentido en roles clínicos o
-- administrativos, no en assistant/supervisor.
alter table public.profiles drop constraint if exists is_org_admin_only_for_clinical_or_admin_roles;
alter table public.profiles add constraint is_org_admin_only_for_clinical_or_admin_roles
  check (not is_org_admin or role in ('therapist', 'psychiatrist', 'org_admin', 'super_admin'));

-- ----------------------------------------------------------------------------
-- 2. is_org_admin_or_super(): un solo cambio, efecto propagado
-- ----------------------------------------------------------------------------
-- Por qué esto alcanza para todo el sistema sin tocar cada policy: cada
-- política de clinics, profiles, consent_templates, y la lectura auditada de
-- org_admin sobre datos clínicos, ya llama a is_org_admin_or_super() en vez
-- de comparar role = 'org_admin' directamente. Al cambiar la función, el
-- efecto se propaga solo.
--
-- Para el acceso clínico (patients, clinical_records, consultations,
-- diagnósticos, recetas, evaluaciones) no hace falta tocar nada: un perfil
-- con role = 'therapist'/'psychiatrist' ya tiene ese acceso por las policies
-- existentes, sin importar si además tiene is_org_admin = true.
create or replace function public.is_org_admin_or_super()
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and active
      and (role in ('org_admin', 'super_admin') or is_org_admin)
  );
$$;

-- ----------------------------------------------------------------------------
-- 3. Credenciales generadas por el administrador: cambio obligatorio
-- ----------------------------------------------------------------------------
alter table public.profiles add column if not exists must_change_password boolean not null default false;

-- Función para que el propio usuario limpie su bandera después de cambiar la
-- contraseña, sin ampliar la policy general de UPDATE sobre profiles (que
-- solo permite editar a org_admin/super_admin) -- caso puntual y acotado,
-- mismo patrón que update_own_profile() en
-- 20260804000000_add_update_own_profile_rpc.sql.
create or replace function public.mark_password_changed()
returns void
language sql security definer
set search_path = public, pg_temp
as $$
  update profiles set must_change_password = false where id = auth.uid();
$$;

grant execute on function public.mark_password_changed() to authenticated;
