import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login"];

export async function proxy(request: NextRequest) {
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
  const isPublic = PUBLIC_PATHS.some((p) => path === p);

  // Three states: a user (signed in), null (definitely no session), or
  // undefined (couldn't tell — a transient error talking to Supabase).
  // Only the first two decide a redirect; "undefined" fails open so a
  // hiccup never bounces someone between /login and /dashboard.
  let user;
  try {
    const { data, error } = await supabase.auth.getUser();
    user = error && error.name !== "AuthSessionMissingError" ? undefined : data.user;
    console.log(
      "[proxy]",
      path,
      "cookies=",
      request.cookies.getAll().map((c) => c.name),
      "error=",
      error ? { name: error.name, message: error.message, status: error.status } : null,
      "user=",
      user ? user.id : user,
    );
  } catch (e) {
    user = undefined;
    console.log("[proxy]", path, "THROW", e instanceof Error ? e.message : e);
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
