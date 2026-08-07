-- ============================================================================
-- Módulo de psiquiatría — Fase 1 (ver plan-modulo-psiquiatria-cercana.md,
-- sección 2.1 y sección 6 "Orden de trabajo sugerido", paso 1).
-- ============================================================================
-- Agrega el rol 'psychiatrist' al enum user_role.
--
-- Este ALTER TYPE se aísla en su propio archivo de migración a propósito:
-- Postgres no permite usar un valor de enum recién agregado (en un literal,
-- un array, un CHECK constraint, etc.) dentro de la MISMA transacción en la
-- que se agregó ("unsafe use of new value ... of enum type"). El siguiente
-- archivo (20260807000001_psychiatry_care_team.sql), que sí usa
-- 'psychiatrist' en un CHECK constraint, corre después y por lo tanto ya lo
-- encuentra confirmado.
-- ============================================================================

alter type public.user_role add value if not exists 'psychiatrist';
