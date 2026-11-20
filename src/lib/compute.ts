import { planSettlements, type Transfer } from "@/lib/settle";
import type { BalanceRow, GroupOverview, Settlement } from "@/lib/types";
import { daysUntil } from "@/lib/dates";
import { groupBy } from "@/lib/utils";

/** グループの精算状況（実効残高 = 確認待ちも反映した残高で計画する） */
export function summarizeGroup(balances: BalanceRow[], settlements: Settlement[], meId: string) {
  const plan = planSettlements(balances.map((b) => ({ userId: b.user_id, balance: b.effective_balance })));
  const pending = settlements.filter((s) => s.status === "pending");
  const outstanding = balances.reduce((s, b) => s + Math.max(0, b.effective_balance), 0);
  const me = balances.find((b) => b.user_id === meId);
  const totalSpent = balances.reduce((s, b) => s + b.paid, 0);
  const allSettled = plan.length === 0 && pending.length === 0;
  return {
    plan,
    pending,
    outstanding,
    totalSpent,
    allSettled,
    me: me ?? null,
    myPlan: plan.filter((t) => t.from === meId || t.to === meId),
  };
}

export interface MyTransfer extends Transfer {
  groupId: string;
  groupName: string;
}

export function buildDashboard(overview: GroupOverview[], balances: BalanceRow[], meId: string) {
  const byGroup = groupBy(balances, (b) => b.group_id);
  let toReceive = 0;
  let toPay = 0;
  let advanced = 0;
  const transfers: MyTransfer[] = [];
  const perGroup: Record<string, { myBalance: number; outstanding: number }> = {};

  for (const g of overview) {
    const rows = byGroup[g.group_id] ?? [];
    const mine = rows.find((r) => r.user_id === meId);
    const eff = mine?.effective_balance ?? 0;
    if (eff > 0) toReceive += eff;
    if (eff < 0) toPay += -eff;
    if (mine) advanced += Math.max(0, mine.paid - mine.share);
    perGroup[g.group_id] = {
      myBalance: eff,
      outstanding: rows.reduce((s, r) => s + Math.max(0, r.effective_balance), 0),
    };
    for (const t of planSettlements(rows.map((r) => ({ userId: r.user_id, balance: r.effective_balance })))) {
      if (t.from === meId || t.to === meId) transfers.push({ ...t, groupId: g.group_id, groupName: g.name });
    }
  }

  const pendingToConfirm = overview.reduce((s, g) => s + g.pending_to_confirm, 0);
  const dueSoon = overview.filter(
    (g) => g.settlement_due_date && daysUntil(g.settlement_due_date) <= 3 && (perGroup[g.group_id]?.myBalance ?? 0) < 0,
  );

  return {
    toReceive,
    toPay,
    advanced,
    net: toReceive - toPay,
    transfers,
    pendingToConfirm,
    unsettledCount: transfers.length + pendingToConfirm,
    perGroup,
    dueSoon,
  };
}
