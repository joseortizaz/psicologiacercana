-- ============================================================================
-- Importación/exportación CSV, exportación PDF e impresión de expedientes.
-- ============================================================================
-- Este archivo NO agrega tablas nuevas: la importación y exportación de CSV
-- de pacientes/citas reutiliza las policies de INSERT/SELECT ya existentes
-- sobre `patients`/`appointments` (se hace fila por fila desde el cliente,
-- respetando RLS tal cual). Lo que sí hace falta es:
--
--   1. Extender el CHECK de `audit_logs.action` para poder registrar eventos
--      de impresión y exportación (antes solo INSERT/UPDATE/DELETE/SELECT).
--   2. Una función `log_document_access()` que los clientes puedan invocar
--      para dejar ese registro — `audit_logs` no tiene policy de INSERT para
--      `authenticated` (solo se escribe vía triggers/funciones
--      SECURITY DEFINER), así que sin esto un INSERT directo desde el
--      navegador fallaría por RLS.
--   3. `admin_read_clinical_record_full()`: org_admin no tenía, hasta ahora,
--      ninguna vía para leer el expediente clínico completo de un paciente
--      (solo `admin_read_clinical_record`/`admin_read_consultation`, que
--      exigen conocer de antemano el id de cada fila). Esta función arma de
--      una sola vez el expediente + consultas + diagnósticos + recetas para
--      poder imprimirlo/exportarlo, dejando un único evento de auditoría
--      (igual que el resto de las funciones `admin_read_*`).
-- ============================================================================

alter table public.audit_logs drop constraint if exists audit_logs_action_check;
alter table public.audit_logs add constraint audit_logs_action_check
  check (action = any (array['INSERT','UPDATE','DELETE','SELECT','PRINT','EXPORT_PDF','EXPORT_CSV']));

-- ----------------------------------------------------------------------------
-- log_document_access: deja constancia de que el usuario autenticado imprimió
-- o exportó algo. No valida que `p_record_id` pertenezca exactamente a su
-- organización a propósito: para llegar a invocarla, el cliente ya tuvo que
-- leer ese dato vía RLS (o vía una función de acceso elevado que audita por
-- su cuenta la lectura) — esta función únicamente registra el evento de
-- impresión/exportación en sí, con la organización del propio actor.
-- `p_record_id` puede ser un id real (expediente/paciente puntual) o, para
-- exportaciones en lote (ej. "exportar todos los pacientes a CSV"), un uuid
-- generado en el cliente que identifica ese lote — audit_logs.record_id es
-- NOT NULL y no existe hoy el concepto de "lote" en el esquema.
-- ----------------------------------------------------------------------------
create or replace function public.log_document_access(
  p_table_name text,
  p_record_id uuid,
  p_action text
)
returns void
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_org_id uuid;
begin
  if p_action not in ('PRINT','EXPORT_PDF','EXPORT_CSV') then
    raise exception 'Acción de registro no permitida: %', p_action;
  end if;

  if p_table_name not in (
    'clinical_records','patients','appointments','patient_diagnoses',
    'prescription_records','audit_logs'
  ) then
    raise exception 'Tabla no permitida para este registro: %', p_table_name;
  end if;

  v_org_id := auth_organization_id();
  if v_org_id is null then
    raise exception 'No se pudo determinar la organización del usuario autenticado';
  end if;

  insert into audit_logs (actor_id, organization_id, table_name, record_id, action)
  values (auth.uid(), v_org_id, p_table_name, p_record_id, p_action);
end;
$$;

-- ----------------------------------------------------------------------------
-- admin_read_clinical_record_full: acceso elevado y auditado para org_admin,
-- pensado para imprimir/exportar el expediente completo (mismo patrón que
-- admin_read_clinical_record, pero trae de una vez consultas, diagnósticos y
-- recetas en vez de exigir invocaciones separadas por cada fila).
-- ----------------------------------------------------------------------------
create or replace function public.admin_read_clinical_record_full(p_patient_id uuid)
returns jsonb
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_record clinical_records;
  v_result jsonb;
begin
  if auth_role() <> 'org_admin' then
    raise exception 'Solo org_admin puede usar esta función de acceso elevado';
  end if;

  select * into v_record
  from clinical_records
  where patient_id = p_patient_id
    and organization_id = auth_organization_id()
  order by created_at desc
  limit 1;

  if not found then
    return null;
  end if;

  insert into audit_logs (actor_id, organization_id, table_name, record_id, action)
  values (auth.uid(), v_record.organization_id, 'clinical_records', v_record.id, 'SELECT');

  select jsonb_build_object(
    'clinical_record', to_jsonb(v_record),
    'consultations', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.session_date desc)
      from consultations c
      where c.clinical_record_id = v_record.id
    ), '[]'::jsonb),
    'diagnoses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pd.id,
        'type', pd.type,
        'status', pd.status,
        'diagnosed_at', pd.diagnosed_at,
        'notes', pd.notes,
        'diagnosis_code', jsonb_build_object('code', dc.code, 'title', dc.title),
        'diagnosed_by_profile', jsonb_build_object('full_name', dp.full_name)
      ) order by pd.diagnosed_at desc)
      from patient_diagnoses pd
      join diagnosis_codes dc on dc.id = pd.diagnosis_code_id
      left join profiles dp on dp.id = pd.diagnosed_by
      where pd.clinical_record_id = v_record.id
    ), '[]'::jsonb),
    'prescriptions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pr.id,
        'issued_at', pr.issued_at,
        'notes', pr.notes,
        'prescribing_clinician', jsonb_build_object('full_name', pp.full_name),
        'items', coalesce((
          select jsonb_agg(to_jsonb(pi))
          from prescription_items pi
          where pi.prescription_record_id = pr.id
        ), '[]'::jsonb)
      ) order by pr.issued_at desc)
      from prescription_records pr
      left join profiles pp on pp.id = pr.prescribing_clinician_id
      where pr.clinical_record_id = v_record.id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;
