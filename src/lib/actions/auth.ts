"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authMessage } from "@/lib/errors";
import { safeNext } from "@/lib/utils";
import type { FormState } from "@/lib/types";

async function siteOrigin(): Promise<string> {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? ""));
  if (!EMAIL_RE.test(email) || !password) return { error: "メールアドレスとパスワードを入力してください。" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: authMessage(error) };
  redirect(next);
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const displayName = String(formData.get("display_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? ""));

  if (displayName.length < 1 || displayName.length > 30) return { error: "表示名は1〜30文字で入力してください。" };
  if (!EMAIL_RE.test(email)) return { error: "メールアドレスの形式が正しくありません。" };
  if (password.length < 8) return { error: "パスワードは8文字以上にしてください。" };

  const supabase = await createClient();
  const origin = await siteOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { error: authMessage(error) };
  if (data.session) redirect(next);
  return {
    success: `${email} に確認メールを送信しました。メール内のリンクを開くと登録が完了します。`,
  };
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!EMAIL_RE.test(email)) return { error: "メールアドレスの形式が正しくありません。" };
  const supabase = await createClient();
  const origin = await siteOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  if (error && error.status === 429) return { error: authMessage(error) };
  // 登録の有無は明かさない
  return { success: "パスワード再設定用のメールを送信しました（登録済みのアドレスの場合）。メールのリンクを開いてください。" };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "パスワードは8文字以上にしてください。" };
  if (password !== confirm) return { error: "確認用のパスワードが一致しません。" };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "リンクの有効期限が切れています。もう一度パスワード再設定をお試しください。" };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: authMessage(error) };
  return { success: "パスワードを変更しました。" };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
