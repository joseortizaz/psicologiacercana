-- ----------------------------------------------------------------------------
-- Pacientes siempre asignados a un profesional (psicólogo o psiquiatra)
-- ----------------------------------------------------------------------------
-- Problema: la lista "Pacientes" de cada profesional solo muestra los pacientes
-- con primary_therapist_id = él, mientras que Administración muestra todos los
-- de la clínica. Un paciente creado sin profesional (por ejemplo desde
-- Administración, o por una secretaria) quedaba "sin asignar" y el profesional
-- no lo veía, lo volvía a crear y se duplicaba.
--
-- Regla nueva, en el momento de insertar un paciente sin profesional:
--   1. Si lo crea un psicólogo/psiquiatra activo de la organización, queda
--      asignado a sí mismo (profesionales independientes).
--   2. Si no, y la clínica tiene exactamente UN psicólogo/psiquiatra activo
--      (consultorio individual con secretaria), queda asignado a esa persona.
--   3. Si hay varios profesionales, se deja sin asignar para que la secretaria
--      o el administrador lo asignen (la interfaz lo ofrece en la lista).
-- Una asignación explícita nunca se cambia.
--
-- Además se asignan los pacientes que ya estaban sin profesional en clínicas
-- con un solo profesional activo.
-- ----------------------------------------------------------------------------
create or replace function public.assign_patient_professional()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_pro uuid;
  v_count integer;
begin
  if NEW.primary_therapist_id is not null then
    return NEW;
  end if;

  -- 1. Quien crea es un profesional clínico activo de esta organización.
  if auth.uid() is not null then
    select p.id into v_pro
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('therapist', 'psychiatrist')
      and p.organization_id = NEW.organization_id;
    if v_pro is not null then
      NEW.primary_therapist_id := v_pro;
      return NEW;
    end if;
  end if;

  -- 2. La clínica tiene un único profesional clínico activo.
  select count(*), min(p.id::text)::uuid into v_count, v_pro
  from public.profiles p
  where p.organization_id = NEW.organization_id
    and p.clinic_id = NEW.clinic_id
    and p.active = true
    and p.role in ('therapist', 'psychiatrist');

  if v_count = 1 then
    NEW.primary_therapist_id := v_pro;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_assign_patient_professional on public.patients;
create trigger trg_assign_patient_professional
  before insert on public.patients
  for each row execute function public.assign_patient_professional();

-- Pacientes existentes sin profesional en clínicas con un solo profesional activo.
update public.patients pt
set primary_therapist_id = sole.id
from (
  select p.organization_id, p.clinic_id, min(p.id::text)::uuid as id
  from public.profiles p
  where p.active = true
    and p.role in ('therapist', 'psychiatrist')
    and p.clinic_id is not null
  group by p.organization_id, p.clinic_id
  having count(*) = 1
) sole
where pt.primary_therapist_id is null
  and pt.organization_id = sole.organization_id
  and pt.clinic_id = sole.clinic_id;
