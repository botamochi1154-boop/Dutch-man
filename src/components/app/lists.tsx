import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, Receipt } from "lucide-react";
import { Amount, CategoryBadge } from "@/components/app/bits";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { CATEGORIES } from "@/lib/constants";
import { formatDate, formatRelative } from "@/lib/dates";
import { formatYen } from "@/lib/money";
import type { ActivityLog, Expense, PeopleMap } from "@/lib/types";

const unknown = { display_name: "退会したユーザー", avatar_color: "#9aa5a0" };

export function ExpenseList({
  expenses,
  people,
  meId,
  myShares,
  groupNames,
  emptyAction,
}: {
  expenses: Expense[];
  people: PeopleMap;
  meId: string;
  /** expense_id → 自分の負担額 */
  myShares?: Record<string, number>;
  /** group_id → グループ名（複数グループを混ぜて表示する場合） */
  groupNames?: Record<string, string>;
  emptyAction?: ReactNode;
}) {
  if (!expenses.length) {
    return (
      <EmptyState
        icon={<Receipt />}
        title="まだ支出がありません"
        description="立て替えたら「＋」から登録しましょう。全員の画面にすぐ共有されます。"
        action={emptyAction}
      />
    );
  }
  return (
    <ul className="divide-y divide-line">
      {expenses.map((e) => {
        const payer = people[e.paid_by] ?? unknown;
        const mine = myShares?.[e.id];
        return (
          <li key={e.id}>
            <Link
              href={`/groups/${e.group_id}/expenses/${e.id}`}
              className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-canvas/70 sm:px-5"
            >
              <CategoryBadge category={e.category} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-ink">{e.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {formatDate(e.spent_on)}・{e.paid_by === meId ? "あなた" : payer.display_name}が支払い
                  {groupNames?.[e.group_id] && <>・{groupNames[e.group_id]}</>}
                </p>
              </div>
              <div className="text-right">
                <Amount value={e.amount} className="text-[15px]" />
                {mine !== undefined ? (
                  <p className="num mt-0.5 text-[11px] text-muted">あなたの負担 {formatYen(mine)}</p>
                ) : (
                  <p className="mt-0.5 text-[11px] text-muted">{CATEGORIES[e.category]?.label}</p>
                )}
              </div>
              <ChevronRight className="hidden size-4 text-line sm:block" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function ActivityFeed({
  logs,
  people,
  meId,
  groupNames,
}: {
  logs: ActivityLog[];
  people: PeopleMap;
  meId: string;
  groupNames?: Record<string, string>;
}) {
  if (!logs.length) return <p className="px-5 py-8 text-center text-[13px] text-muted">まだ活動はありません</p>;
  return (
    <ol className="space-y-0 px-4 py-2 sm:px-5">
      {logs.map((l, i) => {
        const actor = (l.actor_id && people[l.actor_id]) || unknown;
        return (
          <li key={l.id} className="relative flex gap-3 py-2.5">
            {i < logs.length - 1 && <span className="absolute left-[15px] top-10 bottom-0 w-px bg-line" aria-hidden />}
            <Avatar name={actor.display_name} color={actor.avatar_color} size={30} />
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[13px] leading-relaxed text-ink">
                <span className="font-semibold">{l.actor_id === meId ? "あなた" : actor.display_name}</span>
                <span className="text-ink-soft">：{l.summary}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted">
                {formatRelative(l.created_at)}
                {groupNames?.[l.group_id] && <>・{groupNames[l.group_id]}</>}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
