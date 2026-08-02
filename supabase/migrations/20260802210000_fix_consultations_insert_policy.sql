-- ============================================================================
-- FIX: consultations_insert compara columnas de clinical_records contra sí
-- mismas en vez de contra las columnas correspondientes de consultations.
-- ============================================================================
-- La policy original (ver comentario en 20260101000000_baseline_schema.sql,
-- reconstruida fielmente desde producción) tiene esta condición dentro del
-- EXISTS:
--
--   and cr.patient_id = cr.patient_id
--   and cr.organization_id = cr.organization_id
--
-- Ambas son tautologías (una columna comparada contra sí misma), así que en
-- la práctica nunca verifican que el clinical_record referenciado por
-- clinical_record_id pertenezca al mismo paciente/organización que la fila
-- de consultations que se está insertando. El único chequeo real que
-- sobrevive es que el clinical_record exista y que su primary_therapist_id
-- sea el usuario autenticado.
--
-- Impacto: un terapeuta podía insertar una consulta con clinical_record_id
-- apuntando a un expediente propio válido, pero con patient_id de OTRO
-- paciente (de su misma organización o, más grave, de otra organización
-- vía patient_id filtrado por otra vía) — la nota clínica quedaría asociada
-- al paciente equivocado sin que RLS lo bloqueara.
--
-- Este fix compara contra las columnas reales de la fila que se inserta.
-- ============================================================================

drop policy if exists consultations_insert on public.consultations;
create policy consultations_insert on public.consultations
  for insert with check (
    organization_id = auth_organization_id()
    and auth_role() = 'therapist'::user_role
    and therapist_id = auth.uid()
    and exists (
      select 1 from clinical_records cr
      where cr.id = consultations.clinical_record_id
        and cr.patient_id = consultations.patient_id
        and cr.primary_therapist_id = auth.uid()
        and cr.organization_id = consultations.organization_id
    )
  );
