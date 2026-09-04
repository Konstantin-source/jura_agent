import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getAllowedEmails,
  getSupabaseRuntimeConfiguration,
  isDemoMode,
} from "@/lib/config/env";

const PUBLIC_PATHS = new Set(["/login", "/api/config", "/api/health"]);

export async function proxy(request: NextRequest) {
  if (isDemoMode()) return NextResponse.next();

  const config = getSupabaseRuntimeConfiguration();
  if (!config.url || !config.anonKey) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Supabase ist nicht konfiguriert." }, { status: 503 });
    }
    if (request.nextUrl.pathname === "/login") return NextResponse.next();
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email?.toLowerCase();
  const allowed = getAllowedEmails();
  const authorized = Boolean(email && allowed.length === 2 && allowed.includes(email));

  if (request.nextUrl.pathname === "/login") {
    return authorized ? NextResponse.redirect(new URL("/", request.url)) : response;
  }
  if (PUBLIC_PATHS.has(request.nextUrl.pathname)) return response;
  if (!authorized) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Bitte melde dich an." }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
