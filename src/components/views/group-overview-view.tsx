import Link from "next/link";
import { ArrowRight, CalendarClock, CircleCheck, Plus } from "lucide-react";
import { Amount, SectionTitle } from "@/components/app/bits";
import { ActivityFeed, ExpenseList } from "@/components/app/lists";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert, Avatar, Badge } from "@/components/ui/misc";
import type { summarizeGroup } from "@/lib/compute";
import { dueLabel } from "@/lib/dates";
import { formatYen } from "@/lib/money";
import type { ActivityLog, BalanceRow, Expense, Group, Member, PeopleMap } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface GroupOverviewData {
  group: Group;
  meId: string;
  members: Member[];
  people: PeopleMap;
  balances: BalanceRow[];
  summary: ReturnType<typeof summarizeGroup>;
  expenses: Expense[];
  myShares: Record<string, number>;
  logs: ActivityLog[];
  joined?: boolean;
}

export function GroupOverviewView({ group, meId, members, people, balances, summary, expenses, myShares, logs, joined }: GroupOverviewData) {
  const base = `/groups/${group.id}`;
  const myBal = summary.me?.effective_balance ?? 0;
  const byUser = Object.fromEntries(balances.map((b) => [b.user_id, b]));
  const rows = members
    .filter((m) => !m.left_at || (byUser[m.user_id] && byUser[m.user_id].balance !== 0))
    .map((m) => ({ id: m.user_id, b: byUser[m.user_id] }))
    .sort((a, b) => (b.b?.paid ?? 0) - (a.b?.paid ?? 0));
  const maxPaid = Math.max(1, ...rows.map((r) => Math.max(r.b?.paid ?? 0, r.b?.share ?? 0)));
  const due = group.settlement_due_date ? dueLabel(group.settlement_due_date) : null;

  return (
    <>
      {joined && (
        <Alert tone="success" className="mb-4" title={`「${group.name}」に参加しました`}>
          メンバーが登録した支出や精算状況が、この画面にリアルタイムで表示されます。
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-muted">総支出</p>
          <Amount value={summary.totalSpent} className="mt-1 block text-[22px]" />
          <p className="mt-0.5 text-[11px] text-muted">{expenses.length ? `${members.filter((m) => !m.left_at).length}人で利用` : "支出はまだありません"}</p>
        </Card>
        <Card className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-muted">未精算の金額</p>
          <Amount value={summary.outstanding} tone={summary.outstanding ? "neutral" : "muted"} className="mt-1 block text-[22px]" />
          <p className="mt-0.5 text-[11px] text-muted">
            {summary.allSettled ? "精算完了" : `送金 ${summary.plan.length} 回で精算`}
            {summary.pending.length > 0 && `・確認待ち ${summary.pending.length}件`}
          </p>
        </Card>
        <Card className={cn("col-span-2 p-4 sm:p-5 lg:col-span-1", myBal < 0 && "border-[#f1d0cc]", myBal > 0 && "border-brand-200")}>
          <p className="text-xs font-semibold text-muted">
            あなたは{myBal > 0 ? "受け取る" : myBal < 0 ? "支払う" : "精算済み"}
          </p>
          <Amount value={myBal} sign tone="auto" className="mt-1 block text-[22px]" />
          {due ? (
            <p
              className={cn(
                "mt-0.5 flex items-center gap-1 text-[11px] font-semibold",
                due.tone === "danger" ? "text-minus" : due.tone === "warn" ? "text-warn" : "text-muted",
              )}
            >
              <CalendarClock className="size-3.5" />
              {due.text}
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] text-muted">精算期限は未設定</p>
          )}
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5 [&>*]:min-w-0">
        <Card className="lg:col-span-3">
          <CardHeader title="メンバー別の立替・負担" description="立替＝支払った額／負担＝割り勘での自分の分" />
          <ul className="mt-2 space-y-4 px-5 pb-5 pt-2">
            {rows.map(({ id, b }) => {
              const p = people[id];
              const paid = b?.paid ?? 0;
              const share = b?.share ?? 0;
              const bal = b?.effective_balance ?? 0;
              return (
                <li key={id}>
                  <div className="flex items-center gap-3">
                    <Avatar name={p?.display_name ?? "?"} color={p?.avatar_color ?? "#9aa5a0"} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-ink">
                          {p?.display_name ?? "退会したユーザー"}
                          {id === meId && <span className="ml-1 text-xs font-normal text-muted">（あなた）</span>}
                        </p>
                        <Amount value={bal} sign tone="auto" className="text-sm" />
                      </div>
                      <div className="mt-1.5 space-y-1">
                        <Bar value={paid} max={maxPaid} className="bg-brand-500" label={`立替 ${formatYen(paid)}`} />
                        <Bar value={share} max={maxPaid} className="bg-[#c9d3ce]" label={`負担 ${formatYen(share)}`} />
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="精算状況"
            action={
              <Link href={`${base}/settle`} className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-brand-700">
                精算へ <ArrowRight className="size-4" />
              </Link>
            }
          />
          <div className="px-5 pb-5 pt-3">
            {summary.allSettled ? (
              <div className="flex flex-col items-center rounded-xl bg-brand-50 py-6 text-center">
                <CircleCheck className="size-8 text-brand-600" />
                <p className="mt-2 text-sm font-bold text-brand-800">全員の精算が完了しています</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {summary.plan.slice(0, 5).map((t) => {
                  const f = people[t.from];
                  const to = people[t.to];
                  const mine = t.from === meId || t.to === meId;
                  return (
                    <li key={`${t.from}-${t.to}`} className={cn("flex items-center gap-2 rounded-xl px-3 py-2.5", mine ? "bg-brand-50" : "bg-canvas")}>
                      <Avatar name={f?.display_name ?? "?"} color={f?.avatar_color ?? "#9aa5a0"} size={26} />
                      <ArrowRight className="size-3.5 text-muted" />
                      <Avatar name={to?.display_name ?? "?"} color={to?.avatar_color ?? "#9aa5a0"} size={26} />
                      <p className="min-w-0 flex-1 truncate text-[13px] text-ink-soft">
                        {f?.display_name} → {to?.display_name}
                      </p>
                      <span className="num text-sm font-bold text-ink">{formatYen(t.amount)}</span>
                    </li>
                  );
                })}
                {summary.pending.length > 0 && (
                  <li className="pt-1">
                    <Badge tone="info">確認待ち {summary.pending.length}件</Badge>
                  </li>
                )}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <SectionTitle
        action={
          <Link href={`${base}/expenses`} className="text-[13px] font-semibold text-brand-700">
            すべて見る
          </Link>
        }
      >
        最近の支出
      </SectionTitle>
      <Card className="overflow-hidden">
        <ExpenseList
          expenses={expenses}
          people={people}
          meId={meId}
          myShares={myShares}
          emptyAction={
            <Link href={`${base}/expenses/new`} className={buttonVariants({})}>
              <Plus /> 最初の支出を登録
            </Link>
          }
        />
      </Card>

      <SectionTitle>グループの活動</SectionTitle>
      <Card>
        <ActivityFeed logs={logs} people={people} meId={meId} />
      </Card>
    </>
  );
}

function Bar({ value, max, className, label }: { value: number; max: number; className: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas">
        <div className={cn("h-full rounded-full", className)} style={{ width: `${Math.max(value > 0 ? 2 : 0, (value / max) * 100)}%` }} />
      </div>
      <span className="num w-[92px] shrink-0 text-right text-[11px] text-muted">{label}</span>
    </div>
  );
}
