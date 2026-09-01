import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Gracias al matcher de abajo, este middleware SOLO corre sobre las rutas
  // del panel autenticado (dashboard, account, assistant, org-admin,
  // psychiatrist, super-admin, supervisor, therapist). La portada y el
  // resto del sitio de marketing (/, /preguntas-frecuentes, /precios,
  // /terminos, /privacidad, /registro, /login, /forgot-password,
  // /set-password, /change-password, /auth/*) nunca invocan este código y
  // por lo tanto nunca dependen de que Supabase responda: si el API
  // Gateway de Supabase está degradado o caído, esas páginas públicas
  // siguen cargando con normalidad.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Únicamente las rutas que viven dentro del panel autenticado
    // (el grupo app/(protected)/*) requieren sesión. Todo lo demás —
    // portada, páginas de marketing, login, registro, recuperación de
    // contraseña, etc. — queda fuera del matcher y jamás ejecuta este
    // middleware ni llama a supabase.auth.getUser().
    "/dashboard/:path*",
    "/account/:path*",
    "/assistant/:path*",
    "/org-admin/:path*",
    "/psychiatrist/:path*",
    "/super-admin/:path*",
    "/supervisor/:path*",
    "/therapist/:path*",
  ],
};
