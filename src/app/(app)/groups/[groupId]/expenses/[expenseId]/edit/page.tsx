import { notFound } from "next/navigation";
import { ExpenseForm } from "@/components/expense/expense-form";
import { todayJST } from "@/lib/dates";
import { getExpenseDetail, getGroupContext, hasConfirmedSettlementAfter } from "@/lib/queries";

export const metadata = { title: "支出を編集" };

export default async function EditExpensePage({ params }: { params: Promise<{ groupId: string; expenseId: string }> }) {
  const { groupId, expenseId } = await params;
  const { supabase, user, members, people, isAdmin } = await getGroupContext(groupId);
  const { expense, splits } = await getExpenseDetail(supabase, groupId, expenseId);
  if (expense.deleted_at) notFound();
  const canEdit = isAdmin || expense.created_by === user.id || expense.paid_by === user.id;
  if (!canEdit) notFound();
  const settled = await hasConfirmedSettlementAfter(supabase, groupId, expense.created_at);

  // 現メンバー＋（退出済みでも）この支出に含まれていた人を、参加日時順に
  const involved = new Set([expense.paid_by, ...splits.map((s) => s.user_id)]);
  const formMembers = members
    .filter((m) => !m.left_at || involved.has(m.user_id))
    .map((m) => ({
      userId: m.user_id,
      name: people[m.user_id]?.display_name ?? "退会したユーザー",
      color: people[m.user_id]?.avatar_color ?? "#9aa5a0",
    }));

  return (
    <>
      <h1 className="mb-4 text-[22px] font-extrabold tracking-tight text-ink">支出を編集</h1>
      <ExpenseForm
        groupId={groupId}
        meId={user.id}
        today={todayJST()}
        members={formMembers}
        settledWarning={settled}
        initial={{
          expenseId: expense.id,
          updatedAt: expense.updated_at,
          title: expense.title,
          amount: expense.amount,
          paidBy: expense.paid_by,
          category: expense.category,
          spentOn: expense.spent_on,
          memo: expense.memo ?? "",
          splitMethod: expense.split_method,
          participants: splits.map((s) => s.user_id),
          values: Object.fromEntries(splits.filter((s) => s.input_value !== null).map((s) => [s.user_id, s.input_value as number])),
        }}
      />
    </>
  );
}
