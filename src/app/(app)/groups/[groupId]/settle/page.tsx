import { SettleBoard } from "@/components/settle/settle-board";
import { summarizeGroup } from "@/lib/compute";
import { getGroupBalances, getGroupContext, getSettlements } from "@/lib/queries";

export const metadata = { title: "精算" };

export default async function SettlePage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const { supabase, user, group, people, isAdmin } = await getGroupContext(groupId);
  const [balances, settlements] = await Promise.all([getGroupBalances(supabase, groupId), getSettlements(supabase, groupId)]);
  const summary = summarizeGroup(balances, settlements, user.id);

  return (
    <SettleBoard
      groupId={groupId}
      meId={user.id}
      isAdmin={isAdmin}
      people={people}
      balances={balances}
      plan={summary.plan}
      pending={summary.pending}
      history={settlements.filter((s) => s.status !== "pending").slice(0, 50)}
      dueDate={group.settlement_due_date}
    />
  );
}
