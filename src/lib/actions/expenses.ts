"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { toMessage } from "@/lib/errors";
import type { ActionResult, Category, SplitMethod } from "@/lib/types";

export interface SaveExpensePayload {
  groupId: string;
  expenseId?: string;
  expectedUpdatedAt?: string;
  confirmSettled?: boolean;
  title: string;
  amount: number;
  paidBy: string;
  category: Category;
  spentOn: string;
  memo: string;
  splitMethod: SplitMethod;
  participants: string[];
  values: number[] | null;
}

function refresh(groupId: string) {
  revalidatePath(`/groups/${groupId}`, "layout");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
}

/** 登録・編集。負担額は DB 側（private.compute_split）で計算・検証される */
export async function saveExpense(p: SaveExpensePayload): Promise<ActionResult> {
  if (!Number.isSafeInteger(p.amount)) return { ok: false, error: toMessage("INVALID_AMOUNT") };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_expense", {
    p_group_id: p.groupId,
    p_title: p.title,
    p_amount: p.amount,
    p_paid_by: p.paidBy,
    p_category: p.category,
    p_spent_on: p.spentOn,
    p_memo: p.memo,
    p_split_method: p.splitMethod,
    p_participants: p.participants,
    p_values: p.splitMethod === "equal" ? null : p.values,
    p_expense_id: p.expenseId ?? null,
    p_expected_updated_at: p.expectedUpdatedAt ?? null,
    p_confirm_settled: p.confirmSettled ?? false,
  });
  if (error) return { ok: false, error: toMessage(error) };
  refresh(p.groupId);
  return { ok: true, id: data as string, message: p.expenseId ? "支出を更新しました。" : "支出を登録しました。" };
}

export async function deleteExpense(groupId: string, expenseId: string, confirmSettled: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_expense", { p_expense_id: expenseId, p_confirm_settled: confirmSettled });
  if (error) return { ok: false, error: toMessage(error) };
  refresh(groupId);
  return { ok: true, message: "支出を削除しました。" };
}
