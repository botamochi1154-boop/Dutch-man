import { DashboardView } from "@/components/views/dashboard-view";
import { buildDashboard } from "@/lib/compute";
import { getActivity, getExpenses, getMyBalances, getMyProfile, getOverview, getPeople, getSplits, requireUser } from "@/lib/queries";

export const metadata = { title: "ホーム" };

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();
  const [profile, overview, balances, people, logs] = await Promise.all([
    getMyProfile(),
    getOverview(supabase),
    getMyBalances(supabase),
    getPeople(supabase),
    getActivity(supabase, { limit: 8 }),
  ]);
  const expenses = await getExpenses(supabase, { groupIds: overview.map((g) => g.group_id), limit: 6 });
  const splits = await getSplits(supabase, { expenseIds: expenses.map((e) => e.id), userId: user.id });
  const myShares: Record<string, number> = Object.fromEntries(expenses.map((e) => [e.id, 0]));
  for (const s of splits) myShares[s.expense_id] = s.share_amount;

  return (
    <DashboardView
      me={{ id: user.id, display_name: profile.display_name }}
      overview={overview}
      summary={buildDashboard(overview, balances, user.id)}
      people={people}
      expenses={expenses}
      myShares={myShares}
      logs={logs}
    />
  );
}
