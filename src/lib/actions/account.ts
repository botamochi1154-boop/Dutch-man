"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { toMessage } from "@/lib/errors";
import { AVATAR_COLORS } from "@/lib/constants";
import type { ActionResult, FormState } from "@/lib/types";

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("display_name") ?? "").trim();
  const color = String(formData.get("avatar_color") ?? "");
  if (name.length < 1 || name.length > 30) return { error: "表示名は1〜30文字で入力してください。" };
  if (!AVATAR_COLORS.includes(color)) return { error: "アイコンの色を選んでください。" };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: toMessage("NOT_AUTHENTICATED") };
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name, avatar_color: color })
    .eq("id", data.user.id);
  if (error) return { error: toMessage(error) };
  revalidatePath("/", "layout");
  return { success: "プロフィールを保存しました。" };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) return { ok: false, error: toMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}
