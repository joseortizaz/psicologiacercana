-- ============================================================================
-- Tipo de profesional en la solicitud de registro: psicólogo o psiquiatra
-- ============================================================================
-- El solicitante elige "Soy Psicólogo" / "Soy Psiquiatra". Al aprobar, el
-- perfil se crea con role = 'therapist' (psicólogo) o 'psychiatrist'
-- (psiquiatra) (ver review-signup-request).
--
-- Las solicitudes que ya existían son de psicólogos (el formulario no
-- preguntaba otra cosa), de ahí el valor por defecto.
-- ============================================================================

do $$ begin
  create type public.signup_professional_type as enum ('psychologist', 'psychiatrist');
exception when duplicate_object then null;
end $$;

alter table public.signup_requests
  add column if not exists professional_type public.signup_professional_type not null default 'psychologist';

comment on column public.signup_requests.professional_type is
  'psychologist -> perfil therapist; psychiatrist -> perfil psychiatrist. Lo valida submit-signup-request; solo se lee desde el panel del super_admin.';
