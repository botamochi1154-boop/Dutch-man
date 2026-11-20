import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { Amount, GroupBadge, PageHeader } from "@/components/app/bits";
import { RealtimeSync } from "@/components/app/realtime";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AvatarStack, Badge, EmptyState } from "@/components/ui/misc";
import { buildDashboard } from "@/lib/compute";
import { ROLE_LABELS } from "@/lib/constants";
import { formatRelative } from "@/lib/dates";
import { formatYen } from "@/lib/money";
import { getMyBalances, getOverview, getPeople, requireUser } from "@/lib/queries";

export const metadata = { title: "グループ" };

export default async function GroupsPage() {
  const { supabase, user } = await requireUser();
  const [overview, balances, people, members] = await Promise.all([
    getOverview(supabase),
    getMyBalances(supabase),
    getPeople(supabase),
    supabase.from("group_members").select("group_id, user_id").is("left_at", null).order("joined_at"),
  ]);
  const summary = buildDashboard(overview, balances, user.id);
  const membersByGroup: Record<string, string[]> = {};
  for (const m of (members.data ?? []) as { group_id: string; user_id: string }[]) (membersByGroup[m.group_id] ??= []).push(m.user_id);

  return (
    <>
      <RealtimeSync groupIds={overview.map((g) => g.group_id)} />
      <PageHeader
        title="グループ"
        description={`${overview.length}個のグループに参加中`}
        action={
          <Link href="/groups/new" className={buttonVariants({ size: "sm" })}>
            <Plus /> 新規作成
          </Link>
        }
      />
      {overview.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users />}
            title="参加中のグループはありません"
            description="グループを作成するか、メンバーから届いた招待リンクを開いて参加してください。"
            action={
              <Link href="/groups/new" className={buttonVariants({})}>
                グループを作成
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {overview.map((g) => {
            const mine = summary.perGroup[g.group_id]?.myBalance ?? 0;
            const outstanding = summary.perGroup[g.group_id]?.outstanding ?? 0;
            const ids = membersByGroup[g.group_id] ?? [];
            return (
              <Link key={g.group_id} href={`/groups/${g.group_id}`} className="group">
                <Card className="p-5 transition-shadow group-hover:shadow-md">
                  <div className="flex items-start gap-3.5">
                    <GroupBadge icon={g.icon} color={g.color} size={48} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-base font-bold text-ink">{g.name}</p>
                        {g.role !== "member" && <Badge tone="brand">{ROLE_LABELS[g.role]}</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {g.last_activity_at ? `${formatRelative(g.last_activity_at)}に更新` : ""}
                      </p>
                    </div>
                    <AvatarStack
                      size={26}
                      max={4}
                      people={ids.map((id) => ({ name: people[id]?.display_name ?? "?", color: people[id]?.avatar_color ?? "#9aa5a0" }))}
                    />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-canvas px-3 py-2.5">
                    <div>
                      <p className="text-[11px] text-muted">総支出</p>
                      <p className="num text-sm font-bold text-ink">{formatYen(g.total_spent)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted">未精算</p>
                      <p className="num text-sm font-bold text-ink">{formatYen(outstanding)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted">あなた</p>
                      <Amount value={mine} sign tone="auto" className="text-sm" />
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
