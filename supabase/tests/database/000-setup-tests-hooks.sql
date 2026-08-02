-- Pre-test hook: instala pgTAP y el paquete de test helpers de Supabase
-- (basejump-supabase_test_helpers) vía dbdev. Los archivos de test corren
-- en orden alfabético, así que este archivo (000-*) se ejecuta primero.
--
-- Da acceso a: tests.create_supabase_user(), tests.get_supabase_uid(),
-- tests.authenticate_as(), tests.authenticate_as_service_role(),
-- tests.clear_authentication(), tests.rls_enabled().
--
-- Requiere acceso a internet en el runner (descarga el paquete desde
-- database.dev) — en GitHub Actions esto funciona sin configuración
-- adicional.

create extension if not exists pgtap with schema extensions;

create extension if not exists http with schema extensions;
create extension if not exists pg_tle;
drop extension if exists "supabase-dbdev";
select pgtle.uninstall_extension_if_exists('supabase-dbdev');
select
    pgtle.install_extension(
        'supabase-dbdev',
        resp.contents ->> 'version',
        'PostgreSQL package manager',
        resp.contents ->> 'sql'
    )
from extensions.http(
    (
        'GET',
        'https://api.database.dev/rest/v1/'
        || 'package_versions?select=sql,version'
        || '&package_name=eq.supabase-dbdev'
        || '&order=version.desc'
        || '&limit=1',
        array[
            ('apiKey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdXB0cHBsZnZpaWZyYndtbXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODAxMDczNzIsImV4cCI6MTk5NTY4MzM3Mn0.z2CN0mvO2No8wSi46Gw59DFGCTJrzM0AQKsu_5k134s')::extensions.http_header
        ],
        null,
        null
    )
) x,
lateral (
    select
        ((row_to_json(x) -> 'content') #>> '{}')::json -> 0
) resp(contents);
create extension "supabase-dbdev";
select dbdev.install('supabase-dbdev');
drop extension if exists "supabase-dbdev";
create extension "supabase-dbdev";

select dbdev.install('basejump-supabase_test_helpers');
create extension if not exists "basejump-supabase_test_helpers" version '0.0.6';

-- Verificación de humo: si esto falla, todo lo demás se cae por la misma razón.
begin;
select plan(1);
select ok(true, 'Pre-test hook completado: pgTAP + test helpers instalados');
select * from finish();
rollback;
