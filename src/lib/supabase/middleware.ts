import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readSupabaseConfig } from "@/lib/env";

const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/auth", "/invite", "/offline"];

function isPublic(path: string) {
  return path === "/" || PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

/** セッション Cookie を更新し、未ログインで保護ページに来たらログイン画面へ */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const cfg = readSupabaseConfig();
  if (!cfg) return response;

  const supabase = createServerClient(cfg.url, cfg.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (!user && !isPublic(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${path}${request.nextUrl.search}`);
    return withCookies(NextResponse.redirect(url), response);
  }

  if (user && (path === "/login" || path === "/signup")) {
    const next = request.nextUrl.searchParams.get("next");
    const url = request.nextUrl.clone();
    url.pathname = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    url.search = "";
    return withCookies(NextResponse.redirect(url), response);
  }

  return response;
}

function withCookies(target: NextResponse, source: NextResponse) {
  source.cookies.getAll().forEach((c) => target.cookies.set(c));
  return target;
}
