# PsyClinic Cloud — Frontend (Fase 1: login + paneles)

Next.js 14 (App Router) + TypeScript + Tailwind + `@supabase/ssr`.

## Qué incluye

- **`/login`** — login con correo/contraseña.
- **`middleware.ts`** — refresca la sesión de Supabase en cada request y protege todas las rutas excepto `/login`.
- **`(protected)/layout.tsx`** — obtiene el perfil del usuario autenticado y arma el shell de navegación (nombre, rol, botón de salir).
- **`(protected)/`** — redirige automáticamente a `/super-admin` o `/org-admin` según el rol; otros roles ven un mensaje de "en construcción" (sus paneles llegan en fases siguientes).
- **`/super-admin`** — lista de organizaciones, botón para suspender/reactivar, y formulario para registrar una clínica nueva (llama a la Edge Function `onboard-organization`).
- **`/org-admin`** — lista de sucursales (+ crear una nueva), lista de equipo, y formulario para invitar personal (llama a la Edge Function `invite-user`).

Todas las escrituras directas a tablas (crear sucursal, suspender organización) pasan por el cliente de Supabase normal, respetando exactamente las políticas RLS que ya probamos con pgTAP — el frontend no reimplementa ninguna regla de autorización, solo llama a Supabase y confía en RLS.

## Instalación

**Importante:** este proyecto asume que ya tienes una carpeta `supabase/` con las migraciones y Edge Functions (la que armamos junto con este frontend). Coloca todo lo de aquí en la **raíz de esa misma carpeta de proyecto** (`psyclinic-cloud/`), de modo que quede:

```
psyclinic-cloud/
├── app/
├── components/
├── lib/
├── supabase/          <- la que ya tenías (migrations/, functions/)
├── middleware.ts
├── package.json
├── ...
```

Luego:

```bash
npm install
cp .env.local.example .env.local
```

Edita `.env.local` con tu URL y `anon key` reales (Project Settings → API en el dashboard de Supabase).

```bash
npm run dev
```

Abre `http://localhost:3000` — te debería redirigir a `/login`.

## Probar con lo que ya tienes

Inicia sesión con el `super_admin` que ya creaste (`admin@ceapsird.com`) — deberías caer directo en `/super-admin` y ver la clínica de prueba que creaste por `curl`/`Invoke-RestMethod`. Desde ahí puedes registrar clínicas nuevas sin volver a tocar la terminal.

Para probar `/org-admin`, inicia sesión con el `org_admin` de esa clínica de prueba (`joseortiz007@gmail.com`).

## Pendiente / siguientes pasos razonables

1. **Página para fijar contraseña desde el correo de invitación** — ahora mismo, cuando `onboard-organization` o `invite-user` invitan a alguien, el correo de Supabase Auth redirige a una URL que todavía no existe en este proyecto (`/auth/callback` o similar). Sin eso, hay que seguir confirmando usuarios manualmente vía API como hicimos en las pruebas. Es el siguiente bloque lógico a construir.
2. **Recuperar contraseña** (`/forgot-password`).
3. **Paneles para therapist/assistant/supervisor** — llegan naturalmente cuando se construya la UI de pacientes/expedientes/agenda (Fases 2 ya tienen el backend listo, falta la interfaz).
4. **Componentes shadcn/ui** — este scaffold usa inputs/botones con Tailwind plano para no depender de una instalación adicional; si quieres el look de shadcn/ui mencionado en el plan original, se puede migrar después con `npx shadcn init`.
