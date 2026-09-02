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
  // --- DEBUG TEMPORAL: quitar en cuanto encontremos la causa raíz ---
  const debugCookieNames = request.cookies.getAll().map((c) => c.name);
  console.log(
    "[mw-debug] path:",
    request.nextUrl.pathname,
    "cookies:",
    JSON.stringify(debugCookieNames),
  );
  // --- fin bloque debug (los console.log de más abajo también son
  // temporales) ---

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    console.log(
      "[mw-debug] getUser ->",
      JSON.stringify({
        hasUser: !!user,
        userId: user?.id ?? null,
        errorName: error?.name ?? null,
        errorMessage: error?.message ?? null,
        errorStatus: (error as { status?: number } | null)?.status ?? null,
      }),
    );

    if (error) {
      // No pudimos verificar la sesión contra el servidor de Auth de
      // Supabase (por ejemplo, su API está lenta o con errores
      // intermitentes -- ver incidente de Degraded Performance en
      // status.supabase.com). NO tratamos esto como "no hay sesión":
      // eso produce falsos negativos que expulsan a usuarios que sí
      // acaban de autenticarse exitosamente (visto en producción: el
      // POST a /auth/v1/token respondía 200, pero este getUser()
      // fallaba y mandaba de vuelta a /login).
      //
      // En vez de eso, dejamos pasar la solicitud:
      // app/(protected)/layout.tsx hace su propia verificación
      // (getUser() + perfil) antes de renderizar cualquier pantalla del
      // panel y redirige a /login si de verdad no hay sesión válida.
      // Esa sigue siendo la barrera de seguridad real; este middleware
      // es solo un atajo para el caso común, no la única defensa.
      return response;
    }

    if (!user) {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  } catch (thrown) {
    console.log(
      "[mw-debug] getUser threw ->",
      thrown instanceof Error ? thrown.message : String(thrown),
    );
    // Fallo de red al llamar a Supabase (timeout, DNS, etc.) en vez de
    // un error "limpio" de la API. Mismo criterio que arriba: no
    // bloqueamos el acceso por esto, dejamos que la página protegida
    // haga su propia verificación.
    return response;
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
