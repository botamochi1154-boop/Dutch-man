"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { toMessage } from "@/lib/errors";
import type { ActionResult } from "@/lib/types";

function refresh(groupId: string) {
  revalidatePath(`/groups/${groupId}`, "layout");
  revalidatePath("/dashboard");
}

/**
 * 精算の登録。呼び出した人が「支払う側」なら確認待ち、「受け取る側」なら確定として記録される。
 * requestId は画面表示時に発行する冪等キー（連打・再送信で二重登録されない）。
 */
export async function recordSettlement(input: {
  groupId: string;
  from: string;
  to: string;
  amount: number;
  requestId: string;
  note?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.rpc("record_settlement", {
    p_group_id: input.groupId,
    p_from: input.from,
    p_to: input.to,
    p_amount: input.amount,
    p_note: input.note ?? null,
    p_request_id: input.requestId,
  });
  if (error) return { ok: false, error: toMessage(error) };
  refresh(input.groupId);
  const byReceiver = auth.user?.id === input.to;
  return {
    ok: true,
    message: byReceiver ? "受け取りを記録しました。" : "支払いを申告しました。相手が確認すると精算済みになります。",
  };
}

export async function confirmSettlement(groupId: string, id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_settlement", { p_settlement_id: id });
  if (error) return { ok: false, error: toMessage(error) };
  refresh(groupId);
  return { ok: true, message: "受け取りを確認しました。" };
}

export async function rejectSettlement(groupId: string, id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_settlement", { p_settlement_id: id });
  if (error) return { ok: false, error: toMessage(error) };
  refresh(groupId);
  return { ok: true, message: "「受け取っていない」と回答しました。" };
}

export async function cancelSettlement(groupId: string, id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_settlement", { p_settlement_id: id });
  if (error) return { ok: false, error: toMessage(error) };
  refresh(groupId);
  return { ok: true, message: "取り消しました。" };
}

export async function sendReminder(groupId: string, debtorId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_payment_reminder", { p_group_id: groupId, p_debtor: debtorId });
  if (error) return { ok: false, error: toMessage(error) };
  refresh(groupId);
  return { ok: true, message: data ? "リマインドを送りました。" : "今日はすでにリマインド済みです。" };
}
