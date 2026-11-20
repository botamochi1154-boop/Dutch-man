import Link from "next/link";
import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { ExpenseList } from "@/components/app/lists";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CATEGORIES, CATEGORY_KEYS } from "@/lib/constants";
import { formatMonth, monthKey } from "@/lib/dates";
import { formatYen } from "@/lib/money";
import { getExpenses, getGroupContext, getSplits } from "@/lib/queries";
import type { Category, Expense } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata = { title: "支出の履歴" };

export default async function ExpensesPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { groupId } = await params;
  const { c } = await searchParams;
  const category = CATEGORY_KEYS.includes(c as Category) ? (c as Category) : undefined;
  const { supabase, user, people } = await getGroupContext(groupId);
  const expenses = await getExpenses(supabase, { groupId, category });
  const splits = await getSplits(supabase, { groupIds: [groupId], userId: user.id });
  const myShares: Record<string, number> = Object.fromEntries(expenses.map((e) => [e.id, 0]));
  for (const s of splits) if (s.expense_id in myShares) myShares[s.expense_id] = s.share_amount;

  const months: { key: string; items: Expense[]; total: number }[] = [];
  for (const e of expenses) {
    const k = monthKey(e.spent_on);
    let m = months.find((x) => x.key === k);
    if (!m) months.push((m = { key: k, items: [], total: 0 }));
    m.items.push(e);
    m.total += e.amount;
  }
  const base = `/groups/${groupId}/expenses`;

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Chip href={base} active={!category}>
            すべて
          </Chip>
          {CATEGORY_KEYS.map((k) => (
            <Chip key={k} href={`${base}?c=${k}`} active={category === k} color={CATEGORIES[k].color}>
              {CATEGORIES[k].label}
            </Chip>
          ))}
        </div>
        <Link href={`${base}/new`} className={cn(buttonVariants({ size: "sm" }), "hidden shrink-0 sm:inline-flex")}>
          <Plus /> 支出を追加
        </Link>
      </div>

      {months.length === 0 ? (
        <Card>
          <ExpenseList
            expenses={[]}
            people={people}
            meId={user.id}
            emptyAction={
              <Link href={`${base}/new`} className={buttonVariants({})}>
                <Plus /> 支出を登録
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {months.map((m) => (
            <section key={m.key}>
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h2 className="text-[13px] font-bold text-ink-soft">{formatMonth(m.key, true)}</h2>
                <p className="text-xs text-muted">
                  {m.items.length}件・合計 <span className="num font-bold text-ink">{formatYen(m.total)}</span>
                </p>
              </div>
              <Card className="overflow-hidden">
                <ExpenseList expenses={m.items} people={people} meId={user.id} myShares={myShares} />
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function Chip({ href, active, children, color }: { href: string; active: boolean; children: ReactNode; color?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition",
        active ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-soft hover:bg-canvas",
      )}
    >
      {color && <span className="size-2 rounded-full" style={{ backgroundColor: color }} />}
      {children}
    </Link>
  );
}
