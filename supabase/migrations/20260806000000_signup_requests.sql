-- ============================================================================
-- Autoregistro de terapeutas ("Prueba gratuita 14 días" en la landing page).
-- Un psicólogo interesado llena un formulario público y adjunta 3
-- documentos; eso crea una solicitud pendiente que el super_admin debe
-- aprobar antes de que exista cuenta, organización o clínica real.
-- ============================================================================

do $$ begin
  create type public.signup_request_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

create table if not exists public.signup_requests (
  id uuid primary key default gen_random_uuid(),
  status public.signup_request_status not null default 'pending',
  full_name text not null,
  email citext not null,
  phone text,
  license_number text,
  specialty text,
  -- Nombre de la clínica/consultorio que el solicitante indicó (puede ser
  -- su propio nombre, si ejerce de forma independiente).
  clinic_name text not null,
  -- Rutas dentro del bucket privado 'signup-documents', no URLs públicas.
  id_document_path text not null,
  credential_document_path text not null,
  license_document_path text not null,
  rejection_reason text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  -- Se completan al aprobar, para trazabilidad de qué solicitud originó
  -- qué organización/usuario.
  created_organization_id uuid references public.organizations(id),
  created_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Evita solicitudes duplicadas mientras una ya está pendiente para el mismo
-- correo (no bloquea volver a intentar si una anterior fue rechazada).
create unique index if not exists idx_signup_requests_pending_email
  on public.signup_requests (email)
  where status = 'pending';

create index if not exists idx_signup_requests_status
  on public.signup_requests using btree (status, created_at desc);

drop trigger if exists trg_signup_requests_updated_at on public.signup_requests;
create trigger trg_signup_requests_updated_at before update on public.signup_requests
  for each row execute function public.set_updated_at();

alter table public.signup_requests enable row level security;

-- Solo super_admin puede leer las solicitudes desde el cliente. No hay
-- policies de insert/update/delete: el autoregistro público y la
-- aprobación/rechazo se hacen desde edge functions con service_role (que
-- bypassa RLS), porque aprobar una solicitud implica crear organización +
-- clínica + usuario + perfil de forma atómica -- no es un UPDATE simple que
-- tenga sentido exponer como policy.
create policy signup_requests_select on public.signup_requests
  for select using (is_super_admin());

revoke insert, update, delete on public.signup_requests from authenticated, anon;

-- ----------------------------------------------------------------------------
-- Storage: bucket privado para los documentos adjuntos al autoregistro
-- (cédula/pasaporte, carnet o título, licencia/exequátur).
-- ----------------------------------------------------------------------------
-- No se agrega ninguna policy de storage.objects para anon/authenticated:
-- por diseño, nadie accede a estos archivos desde el cliente. Solo las
-- edge functions (service_role) suben los documentos al recibir el
-- formulario, y generan URLs firmadas de corta duración cuando el
-- super_admin necesita revisarlos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'signup-documents',
  'signup-documents',
  false,
  10485760, -- 10 MiB por archivo
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do nothing;
