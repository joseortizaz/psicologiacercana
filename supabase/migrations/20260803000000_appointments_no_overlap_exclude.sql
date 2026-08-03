-- ============================================================================
-- appointments_no_overlap: de índice GIST a EXCLUDE constraint real
-- ============================================================================
-- El índice `appointments_no_overlap` original (ver baseline_schema.sql) solo
-- aceleraba la consulta de traslapes, pero no impedía en la base de datos que
-- un mismo terapeuta quedara agendado dos veces en el mismo horario — eso
-- dependía por completo de que la UI no lo permitiera. Esta migración lo
-- reemplaza por un EXCLUDE constraint GIST equivalente (misma columna, mismo
-- predicado: se excluyen las citas 'cancelled'), que sí rechaza el
-- INSERT/UPDATE con SQLSTATE 23P01 (exclusion_violation) cuando hay traslape
-- para el mismo terapeuta, sin importar qué código lo intente.
--
-- btree_gist ya está habilitado (baseline_schema.sql, sección 0), necesario
-- para poder mezclar `therapist_id` (igualdad) con `tstzrange(...)` (rango)
-- en el mismo EXCLUDE.
--
-- Idempotencia: en producción ya existía un EXCLUDE constraint llamado
-- `appointments_no_overlap` con exactamente esta definición (verificado por
-- consulta directa a pg_constraint) — la nota de fidelidad del baseline
-- (que decía que era "solo un índice GIST") no reflejaba la realidad. Por
-- eso este bloque solo hace el DROP INDEX + ADD CONSTRAINT si todavía NO
-- existe un EXCLUDE constraint con ese nombre: en un entorno nuevo (CI, que
-- sí levanta el baseline tal cual está escrito) lo crea; en producción, que
-- ya lo tiene, no hace nada.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.appointments'::regclass
      and conname = 'appointments_no_overlap'
      and contype = 'x'
  ) then
    execute 'drop index if exists public.appointments_no_overlap';

    alter table public.appointments
      add constraint appointments_no_overlap
      exclude using gist (
        therapist_id with =,
        tstzrange(start_time, end_time) with &&
      )
      where (status <> 'cancelled'::public.appointment_status);
  end if;
end $$;
