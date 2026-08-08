-- ============================================================================
-- Formulario de contacto de la landing page (CTA "Contactar a servicio" del
-- Plan Institucional). A diferencia de signup_requests, este formulario no
-- sube archivos ni crea cuentas/organizaciones -- es solo un mensaje simple
-- de un visitante anónimo, así que se permite INSERT directo desde el
-- cliente vía RLS, sin necesidad de una edge function con service_role.
-- ============================================================================

create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email citext not null,
  phone text,
  message text not null,
  -- Qué plan/CTA originó el mensaje. Restringido a valores conocidos para
  -- evitar basura, pero incluye 'otro' por si se reutiliza el formulario
  -- desde algún otro punto de la landing en el futuro.
  plan_interest text not null default 'institucional'
    check (plan_interest in (
      'esencial', 'duo_clinico', 'profesional_plus', 'clinica_crecimiento',
      'institucional', 'otro'
    )),
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_requests_name_not_blank check (btrim(name) <> ''),
  constraint contact_requests_message_not_blank check (btrim(message) <> ''),
  constraint contact_requests_email_format check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

create index if not exists idx_contact_requests_created_at
  on public.contact_requests using btree (created_at desc);

drop trigger if exists trg_contact_requests_updated_at on public.contact_requests;
create trigger trg_contact_requests_updated_at before update on public.contact_requests
  for each row execute function public.set_updated_at();

alter table public.contact_requests enable row level security;

-- Cualquier visitante (autenticado o no) puede dejar un mensaje. No hay
-- policy de SELECT/UPDATE/DELETE para anon/authenticated: solo super_admin
-- puede leer estas solicitudes.
create policy contact_requests_insert on public.contact_requests
  for insert
  to anon, authenticated
  with check (true);

create policy contact_requests_select on public.contact_requests
  for select using (is_super_admin());

revoke update, delete on public.contact_requests from authenticated, anon;
