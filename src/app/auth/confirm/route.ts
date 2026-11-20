import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/utils";

/**
 * token_hash 方式の確認リンク（登録した端末と別のブラウザでメールを開いても確認できる）。
 * Supabase のメールテンプレートを README の手順で設定すると使われる。
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  // next が無ければ、テンプレートの {{ .RedirectTo }}（= /auth/callback?next=...）から行き先を取り出す
  let next = url.searchParams.get("next");
  const redirectTo = url.searchParams.get("redirect_to");
  if (!next && redirectTo) {
    try {
      const r = new URL(redirectTo, url.origin);
      if (r.origin === url.origin) next = r.pathname === "/auth/callback" ? r.searchParams.get("next") : `${r.pathname}${r.search}`;
    } catch {
      next = null;
    }
  }
  const dest = safeNext(next, type === "recovery" ? "/reset-password" : "/dashboard");

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(dest, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
