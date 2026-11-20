import Link from "next/link";
import { ArrowRight, CalendarClock, ChevronRight, CircleCheck, Inbox, Plus, Users } from "lucide-react";
import { Amount, GroupBadge, PageHeader, SectionTitle } from "@/components/app/bits";
import { ActivityFeed, ExpenseList } from "@/components/app/lists";
import { RealtimeSync } from "@/components/app/realtime";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert, Avatar, Badge, EmptyState } from "@/components/ui/misc";
import type { buildDashboard } from "@/lib/compute";
import { dueLabel } from "@/lib/dates";
import { formatYen } from "@/lib/money";
import type { ActivityLog, Expense, GroupOverview, PeopleMap } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface DashboardData {
  me: { id: string; display_name: string };
  overview: GroupOverview[];
  summary: ReturnType<typeof buildDashboard>;
  people: PeopleMap;
  expenses: Expense[];
  myShares: Record<string, number>;
  logs: ActivityLog[];
}

export function DashboardView({ me, overview, summary, people, expenses, myShares, logs }: DashboardData) {
  const groupNames = Object.fromEntries(overview.map((g) => [g.group_id, g.name]));
  const total = summary.toReceive + summary.toPay;
  const receiveRatio = total ? Math.round((summary.toReceive / total) * 100) : 50;

  return (
    <>
      <RealtimeSync groupIds={overview.map((g) => g.group_id)} />
      <PageHeader title={`${me.display_name}さんのお金`} description="参加中のすべてのグループの精算状況" />

      {summary.pendingToConfirm > 0 && (
        <Alert tone="info" className="mb-3" title={`受け取りの確認待ちが ${summary.pendingToConfirm} 件あります`}>
          メンバーから「支払いました」と申告がありました。受け取ったら確認してください。
        </Alert>
      )}
      {summary.dueSoon.map((g) => (
        <Alert
          key={g.group_id}
          tone="warn"
          className="mb-3"
          title={`${g.name}：${dueLabel(g.settlement_due_date!).text}`}
          action={
            <Link href={`/groups/${g.group_id}/settle`} className={buttonVariants({ size: "sm", variant: "outline" })}>
              精算する
            </Link>
          }
        >
          まだ {formatYen(-(summary.perGroup[g.group_id]?.myBalance ?? 0))} の支払いが残っています。
        </Alert>
      ))}

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="relative overflow-hidden p-5 sm:p-6 lg:col-span-2">
          <div className="absolute -right-10 -top-16 size-48 rounded-full bg-brand-50" aria-hidden />
          <div className="relative">
            <p className="text-[13px] font-semibold text-muted">精算後の差し引き</p>
            <p className="mt-1.5 text-[34px] leading-none sm:text-[40px]">
              <Amount value={summary.net} sign tone={summary.net === 0 ? "neutral" : "auto"} className="font-extrabold tracking-tight" />
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                  <span className="size-2 rounded-full bg-plus" />
                  受け取る予定
                </p>
                <Amount value={summary.toReceive} tone="plus" className="mt-1 block text-xl" />
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                  <span className="size-2 rounded-full bg-minus" />
                  支払う予定
                </p>
                <Amount value={summary.toPay} tone={summary.toPay ? "minus" : "neutral"} className="mt-1 block text-xl" />
              </div>
            </div>
            <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-canvas" aria-hidden>
              {total > 0 && (
                <>
                  <div className="bg-plus" style={{ width: `${receiveRatio}%` }} />
                  <div className="bg-minus" style={{ width: `${100 - receiveRatio}%` }} />
                </>
              )}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
          <Card className="p-4 sm:p-5">
            <p className="text-xs font-semibold text-muted">立て替えた金額</p>
            <Amount value={summary.advanced} className="mt-1 block text-xl" />
            <p className="mt-1 text-[11px] leading-snug text-muted">他の人の分として支払った合計</p>
          </Card>
          <Card className="p-4 sm:p-5">
            <p className="text-xs font-semibold text-muted">未精算</p>
            <p className="mt-1 text-xl font-bold text-ink">
              <span className="num">{summary.unsettledCount}</span>
              <span className="ml-0.5 text-sm">件</span>
            </p>
            <p className="mt-1 text-[11px] leading-snug text-muted">支払い・受け取り・確認待ち</p>
          </Card>
        </div>
      </section>

      <SectionTitle>あなたの精算</SectionTitle>
      <Card>
        {summary.transfers.length === 0 ? (
          <div className="flex items-center gap-3 px-5 py-5">
            <CircleCheck className="size-6 text-brand-600" />
            <p className="text-sm font-semibold text-ink">いま精算が必要なものはありません</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {summary.transfers.map((t) => {
              const pay = t.from === me.id;
              const other = people[pay ? t.to : t.from];
              return (
                <li key={`${t.groupId}-${t.from}-${t.to}`}>
                  <Link href={`/groups/${t.groupId}/settle`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-canvas/70 sm:px-5">
                    <Avatar name={other?.display_name ?? "?"} color={other?.avatar_color ?? "#9aa5a0"} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-ink">
                        {other?.display_name}さん{pay ? "に支払う" : "から受け取る"}
                      </p>
                      <p className="truncate text-xs text-muted">{t.groupName}</p>
                    </div>
                    <Amount value={pay ? -t.amount : t.amount} sign tone="auto" className="text-[15px]" />
                    <ChevronRight className="size-4 text-line" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <SectionTitle
        action={
          <Link href="/groups/new" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700">
            <Plus className="size-4" />
            作成
          </Link>
        }
      >
        参加中のグループ
      </SectionTitle>
      {overview.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users />}
            title="まずはグループを作りましょう"
            description="旅行・飲み会・ルームシェアなど、一緒にお金を管理するメンバーごとにグループを作ります。招待リンクを受け取った場合は、そのリンクを開くと参加できます。"
            action={
              <Link href="/groups/new" className={buttonVariants({})}>
                グループを作成 <ArrowRight />
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {overview.map((g) => {
            const mine = summary.perGroup[g.group_id]?.myBalance ?? 0;
            const due = g.settlement_due_date ? dueLabel(g.settlement_due_date) : null;
            return (
              <Link key={g.group_id} href={`/groups/${g.group_id}`} className="group">
                <Card className="flex items-center gap-3.5 p-4 transition-shadow group-hover:shadow-md">
                  <GroupBadge icon={g.icon} color={g.color} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[15px] font-bold text-ink">{g.name}</p>
                      {g.pending_to_confirm > 0 && <Badge tone="info">確認待ち</Badge>}
                    </div>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                      <span>{g.member_count}人</span>
                      <span>合計 <span className="num">{formatYen(g.total_spent)}</span></span>
                    </p>
                    {due && due.tone !== "muted" && (
                      <p className={cn("mt-1 flex items-center gap-1 text-[11px] font-semibold", due.tone === "danger" ? "text-minus" : "text-warn")}>
                        <CalendarClock className="size-3.5" />
                        {due.text}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-muted">{mine > 0 ? "受け取る" : mine < 0 ? "支払う" : "精算済み"}</p>
                    <Amount value={mine} tone="auto" className="text-[15px]" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-7 grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card className="overflow-hidden">
          <CardHeader title="最近の支出" description="あなたの負担額つき" />
          <div className="mt-2">
            {overview.length === 0 ? (
              <EmptyState icon={<Inbox />} title="まだ支出がありません" />
            ) : (
              <ExpenseList expenses={expenses} people={people} meId={me.id} myShares={myShares} groupNames={groupNames} />
            )}
          </div>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader title="最近の活動" description="メンバーの登録・編集・精算" />
          <div className="mt-1">
            <ActivityFeed logs={logs} people={people} meId={me.id} groupNames={groupNames} />
          </div>
        </Card>
      </div>
    </>
  );
}
