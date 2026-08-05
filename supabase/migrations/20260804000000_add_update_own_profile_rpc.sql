-- ============================================================================
-- Ajustes de cuenta: ningún usuario puede editar su propio nombre, teléfono,
-- cédula profesional o especialidad. La policy profiles_update (ver
-- 20260101000000_baseline_schema.sql) solo autoriza a org_admin/super_admin
-- a modificar filas de profiles, sin excepción para "mi propia fila" — un
-- therapist/assistant/supervisor/org_admin no puede corregir ni siquiera un
-- error de tipeo en su nombre sin pedírselo a un admin.
--
-- En vez de abrir profiles_update con "id = auth.uid()" (lo que dejaría a
-- cualquier usuario reescribir su propio role/organization_id/clinic_id/
-- active si esa policy se toca en el futuro sin cuidado), se agrega una
-- función SECURITY DEFINER de superficie mínima: solo puede tocar full_name,
-- phone, license_number y specialty, y solo de la propia fila (auth.uid()),
-- vía UPDATE real -- así trg_audit_profiles sigue auditando estos cambios
-- igual que cualquier otro UPDATE sobre profiles.
-- ============================================================================

create or replace function public.update_own_profile(
  p_full_name text,
  p_phone text,
  p_license_number text,
  p_specialty text
)
returns public.profiles
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_record public.profiles;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if p_full_name is null or btrim(p_full_name) = '' then
    raise exception 'El nombre no puede estar vacío';
  end if;

  update public.profiles
  set
    full_name = btrim(p_full_name),
    phone = nullif(btrim(coalesce(p_phone, '')), ''),
    license_number = nullif(btrim(coalesce(p_license_number, '')), ''),
    specialty = nullif(btrim(coalesce(p_specialty, '')), '')
  where id = auth.uid()
  returning * into v_record;

  if not found then
    raise exception 'Perfil no encontrado';
  end if;

  return v_record;
end;
$$;

grant execute on function public.update_own_profile(text, text, text, text) to authenticated;
