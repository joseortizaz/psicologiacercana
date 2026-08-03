-- Diagnóstico: ¿qué es realmente `appointments_no_overlap` en producción?
-- El intento de aplicar 20260803000000_appointments_no_overlap_exclude.sql
-- falló con: "cannot drop index appointments_no_overlap because constraint
-- appointments_no_overlap on table appointments requires it" — o sea, ya
-- existe un CONSTRAINT (no solo un índice) con ese nombre. Esta consulta
-- muestra su definición exacta para poder corregir la migración.

select
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.appointments'::regclass
  and conname = 'appointments_no_overlap';
