import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/programeaza"];

// /programeaza and every personal link under it (/programeaza/<name>) are public.
const isPublicPath = (path: string) => PUBLIC_PATHS.includes(path) || path.startsWith("/programeaza/");

// No auth decision ever depends on this path (nothing to redirect to/from) —
// skip the Supabase round trip entirely instead of paying for it and
// throwing the result away. /login stays out of this: it still needs the
// session check below to bounce an already-logged-in visitor to /dashboard.
const NO_AUTH_CHECK_PATHS = ["/", "/programeaza"];

export async function proxy(request: NextRequest) {
  if (NO_AUTH_CHECK_PATHS.includes(request.nextUrl.pathname) || request.nextUrl.pathname.startsWith("/programeaza/")) {
    return NextResponse.next();
  }

  // Collected separately from the response so that whichever response we
  // end up returning (a redirect or a pass-through) always carries any
  // refreshed session cookies. Building a *new* NextResponse.redirect(...)
  // after the fact — without copying these over — silently drops the
  // refreshed tokens and breaks the session on the very next request,
  // which is what caused the /login <-> /dashboard redirect loop.
  const pendingCookies: { name: string; value: string; options?: CookieOptions }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          pendingCookies.push(...cookiesToSet);
        },
      },
    },
  );

  const path = request.nextUrl.pathname;
  const isPublic = isPublicPath(path);

  // Redirect decisions only need to know whether a session exists, which is read from the cookie (and refreshed
  // when expired) — no network call on every click. Every page re-validates the user against Supabase Auth
  // (getUser in getAppContext) and row-level security guards the data, so this is not the security boundary.
  // user: truthy = signed in, null = definitely signed out, undefined = couldn't tell (fail open).
  let user: true | null | undefined;
  try {
    const { data, error } = await supabase.auth.getSession();
    user = error && error.name !== "AuthSessionMissingError" ? undefined : data.session ? true : null;
  } catch {
    user = undefined;
  }

  let response: NextResponse;
  if (user === null && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", path);
    response = NextResponse.redirect(url);
  } else if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.searchParams.delete("redirectTo");
    response = NextResponse.redirect(url);
  } else {
    response = NextResponse.next({ request });
  }

  pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|landing-assets/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
