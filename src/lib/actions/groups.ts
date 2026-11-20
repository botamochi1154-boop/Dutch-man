"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toMessage } from "@/lib/errors";
import { isUuid } from "@/lib/utils";
import type { ActionResult, FormState, Role } from "@/lib/types";

function refresh(groupId?: string) {
  if (groupId) revalidatePath(`/groups/${groupId}`, "layout");
  revalidatePath("/dashboard");
  revalidatePath("/groups");
}

export async function createGroup(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_group", {
    p_name: String(formData.get("name") ?? ""),
    p_description: String(formData.get("description") ?? ""),
    p_icon: String(formData.get("icon") ?? "users"),
    p_color: String(formData.get("color") ?? "green"),
  });
  if (error) return { error: toMessage(error) };
  refresh();
  redirect(`/groups/${data as string}/members?created=1`);
}

export async function updateGroup(_prev: FormState, formData: FormData): Promise<FormState> {
  const groupId = String(formData.get("group_id") ?? "");
  if (!isUuid(groupId)) return { error: "グループが見つかりません。" };
  const due = String(formData.get("settlement_due_date") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_group", {
    p_group_id: groupId,
    p_name: String(formData.get("name") ?? ""),
    p_description: String(formData.get("description") ?? ""),
    p_icon: String(formData.get("icon") ?? "users"),
    p_color: String(formData.get("color") ?? "green"),
    p_join_approval_required: formData.get("join_approval_required") === "on",
    p_settlement_due_date: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null,
  });
  if (error) return { error: toMessage(error) };
  refresh(groupId);
  return { success: "グループ設定を保存しました。" };
}

export async function deleteGroup(groupId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_group", { p_group_id: groupId });
  if (error) return { ok: false, error: toMessage(error) };
  refresh();
  redirect("/groups");
}

export async function createInvitation(groupId: string, days: number, maxUses: number | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invitation", {
    p_group_id: groupId,
    p_expires_in_days: days,
    p_max_uses: maxUses,
  });
  if (error) return { ok: false, error: toMessage(error) };
  refresh(groupId);
  return { ok: true, id: data as string };
}

export async function revokeInvitation(groupId: string, invitationId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invitation", { p_invitation_id: invitationId });
  if (error) return { ok: false, error: toMessage(error) };
  refresh(groupId);
  return { ok: true, message: "招待リンクを無効にしました。" };
}

export async function acceptInvitation(token: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) return { ok: false, error: toMessage(error) };
  const res = data as { result: string; group_id: string };
  refresh(res.group_id);
  if (res.result === "requested" || res.result === "already_requested") {
    return { ok: true, message: "参加を申請しました。管理者が承認すると参加できます。" };
  }
  redirect(`/groups/${res.group_id}?joined=1`);
}

export async function decideJoinRequest(groupId: string, requestId: string, approve: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_join_request", { p_request_id: requestId, p_approve: approve });
  if (error) return { ok: false, error: toMessage(error) };
  refresh(groupId);
  return { ok: true, message: approve ? "参加を承認しました。" : "申請を見送りました。" };
}

export async function setMemberRole(groupId: string, userId: string, role: Role): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role", { p_group_id: groupId, p_user_id: userId, p_role: role });
  if (error) return { ok: false, error: toMessage(error) };
  refresh(groupId);
  return { ok: true, message: "権限を変更しました。" };
}

export async function removeMember(groupId: string, userId: string, isSelf: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", { p_group_id: groupId, p_user_id: userId });
  if (error) return { ok: false, error: toMessage(error) };
  refresh(groupId);
  if (isSelf) redirect("/groups");
  return { ok: true, message: "メンバーを外しました。" };
}
