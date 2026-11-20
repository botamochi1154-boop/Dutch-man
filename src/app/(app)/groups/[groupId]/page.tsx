import { GroupOverviewView } from "@/components/views/group-overview-view";
import { summarizeGroup } from "@/lib/compute";
import { getActivity, getExpenses, getGroupBalances, getGroupContext, getSettlements, getSplits } from "@/lib/queries";

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ joined?: string }>;
}) {
  const { groupId } = await params;
  const { joined } = await searchParams;
  const { supabase, user, group, members, people } = await getGroupContext(groupId);
  const [balances, settlements, expenses, logs] = await Promise.all([
    getGroupBalances(supabase, groupId),
    getSettlements(supabase, groupId),
    getExpenses(supabase, { groupId, limit: 5 }),
    getActivity(supabase, { groupId, limit: 8 }),
  ]);
  const splits = await getSplits(supabase, { expenseIds: expenses.map((e) => e.id), userId: user.id });
  const myShares: Record<string, number> = Object.fromEntries(expenses.map((e) => [e.id, 0]));
  for (const s of splits) myShares[s.expense_id] = s.share_amount;

  return (
    <GroupOverviewView
      group={group}
      meId={user.id}
      members={members}
      people={people}
      balances={balances}
      summary={summarizeGroup(balances, settlements, user.id)}
      expenses={expenses}
      myShares={myShares}
      logs={logs}
      joined={joined === "1"}
    />
  );
}
