import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // We need to mutate the response when Supabase rotates the access token, so
  // we build `supabaseResponse` first and return it at the end instead of a
  // bare NextResponse.next().
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          // Write updated cookies onto both the request (for downstream
          // Server Components) and the response (for the browser).
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() validates the JWT and refreshes it when it's about to expire.
  // This is what keeps Server Components from seeing stale sessions.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Unauthenticated users → redirect to the appropriate login page
  if (!user) {
    if (pathname.startsWith("/dashboard")) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    if (
      pathname.startsWith("/superadmin") &&
      pathname !== "/superadmin/login"
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/superadmin/login";
      return NextResponse.redirect(url);
    }
  }

  // Authenticated users → skip the auth/home pages, go straight to dashboard
  if (
    user &&
    (pathname === "/" || pathname === "/login" || pathname === "/signup")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     *   - _next/static  (static assets)
     *   - _next/image   (Next.js image optimisation)
     *   - public files  (icons, manifest, sw, offline, favicons, images)
     *   - /menu/*       (public ISR menu — no auth needed)
     *   - /staff/*      (staff portal uses its own localStorage token)
     *   - /api/*        (route handlers handle their own auth)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|icons|manifest\\.json|sw\\.js|offline\\.html|menu/|staff/|api/).*)",
  ],
};
