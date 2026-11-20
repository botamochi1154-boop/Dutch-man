import { ExpenseForm } from "@/components/expense/expense-form";
import { todayJST } from "@/lib/dates";
import { getGroupContext } from "@/lib/queries";

export const metadata = { title: "支出を登録" };

export default async function NewExpensePage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const { user, activeMembers, people } = await getGroupContext(groupId);
  return (
    <>
      <h1 className="mb-4 text-[22px] font-extrabold tracking-tight text-ink">支出を登録</h1>
      <ExpenseForm
        groupId={groupId}
        meId={user.id}
        today={todayJST()}
        members={activeMembers.map((m) => ({
          userId: m.user_id,
          name: people[m.user_id]?.display_name ?? "?",
          color: people[m.user_id]?.avatar_color ?? "#9aa5a0",
        }))}
      />
    </>
  );
}
