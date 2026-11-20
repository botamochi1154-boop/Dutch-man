import Link from "next/link";
import type { ReactNode } from "react";
import { ChartPie } from "lucide-react";
import { Amount, PageHeader } from "@/components/app/bits";
import { CategoryDonut, GroupBars, MemberBars, MonthlyChart } from "@/components/charts/charts";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { CATEGORIES, CATEGORY_KEYS } from "@/lib/constants";
import { formatMonth, lastMonths } from "@/lib/dates";
import { formatYen } from "@/lib/money";
import { getOverview, getPeople, requireUser } from "@/lib/queries";
import { cn, isUuid } from "@/lib/utils";

export const metadata = { title: "分析" };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ g?: string; m?: string; v?: string }> }) {
  const sp = await searchParams;
  const { supabase, user } = await requireUser();
  const [overview, people] = await Promise.all([getOverview(supabase), getPeople(supabase)]);
  const groupId = isUuid(sp.g) && overview.some((g) => g.group_id === sp.g) ? sp.g : undefined;
  const range = sp.m === "12" ? 12 : 6;
  const view = sp.v === "group" ? "group" : "mine";
  const months = lastMonths(range);
  const since = `${months[0]}-01`;

  type Agg = Record<string, number>;
  const { data: raw, error } = await supabase.rpc("my_analytics", { p_since: since, p_group_id: groupId ?? null });
  if (error) throw new Error(error.message);
  const a = (raw ?? {}) as {
    monthly_total?: Agg;
    monthly_mine?: Agg;
    category_total?: Agg;
    category_mine?: Agg;
    group_total?: Agg;
    member_paid?: Agg;
    member_share?: Agg;
  };
  const get = (o: Agg | undefined, k: string) => Number(o?.[k] ?? 0);

  const monthly = months.map((m) => ({ key: m, label: formatMonth(m), total: get(a.monthly_total, m), mine: get(a.monthly_mine, m) }));

  const catSource = view === "mine" ? a.category_mine : a.category_total;
  const categoryData = CATEGORY_KEYS.map((k) => ({ key: k, label: CATEGORIES[k].label, value: get(catSource, k), color: CATEGORIES[k].color }));

  const groupData = overview
    .map((g) => ({ name: g.name.length > 8 ? `${g.name.slice(0, 8)}…` : g.name, value: get(a.group_total, g.group_id) }))
    .filter((g) => g.value > 0)
    .sort((x, y) => y.value - x.value);

  const memberIds = [...new Set([...Object.keys(a.member_paid ?? {}), ...Object.keys(a.member_share ?? {})])];
  const memberData = memberIds
    .map((id) => ({
      name: id === user.id ? "あなた" : (people[id]?.display_name ?? "退会済み"),
      paid: get(a.member_paid, id),
      share: get(a.member_share, id),
    }))
    .sort((x, y) => y.paid - x.paid)
    .slice(0, 12);

  const total = Object.values(a.group_total ?? {}).reduce((x, y) => x + Number(y), 0);
  const mine = Object.values(a.monthly_mine ?? {}).reduce((x, y) => x + Number(y), 0);
  const myPaid = get(a.member_paid, user.id);

  const q = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { g: groupId, m: String(range), v: view, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/analytics?${p.toString()}`;
  };

  return (
    <>
      <PageHeader title="分析" description="お金の流れをグラフで確認できます" />

      {overview.length === 0 ? (
        <Card>
          <EmptyState icon={<ChartPie />} title="まだデータがありません" description="グループに参加して支出を登録すると、ここにグラフが表示されます。" />
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="scrollbar-none -mx-4 flex max-w-full gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <FilterChip href={q({ g: undefined })} active={!groupId}>
                すべてのグループ
              </FilterChip>
              {overview.map((g) => (
                <FilterChip key={g.group_id} href={q({ g: g.group_id })} active={groupId === g.group_id}>
                  {g.name}
                </FilterChip>
              ))}
            </div>
            <div className="ml-auto flex rounded-full border border-line bg-white p-0.5">
              {[6, 12].map((n) => (
                <Link
                  key={n}
                  href={q({ m: String(n) })}
                  className={cn("rounded-full px-3 py-1 text-xs font-semibold", range === n ? "bg-ink text-white" : "text-muted")}
                >
                  {n}か月
                </Link>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Kpi label="期間の総支出" value={total} />
            <Kpi label="あなたの負担" value={mine} />
            <Kpi label="あなたが支払った額" value={myPaid} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5 [&>*]:min-w-0">
            <Card className="lg:col-span-3">
              <CardHeader title="月別の支出" description={`直近${range}か月の推移`} />
              <div className="px-3 pb-2 pt-4 sm:px-4">
                <MonthlyChart data={monthly} />
              </div>
              <details className="border-t border-line px-5 py-3 text-[13px]">
                <summary className="cursor-pointer font-semibold text-ink-soft">表で見る</summary>
                <table className="mt-2 w-full">
                  <thead>
                    <tr className="text-left text-[11px] text-muted">
                      <th className="py-1 font-semibold">月</th>
                      <th className="py-1 text-right font-semibold">グループ合計</th>
                      <th className="py-1 text-right font-semibold">あなたの負担</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.map((m) => (
                      <tr key={m.key} className="border-t border-line">
                        <td className="py-1.5 text-ink-soft">{formatMonth(m.key, true)}</td>
                        <td className="num py-1.5 text-right text-ink">{formatYen(m.total)}</td>
                        <td className="num py-1.5 text-right text-ink">{formatYen(m.mine)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader
                title="カテゴリ別"
                action={
                  <div className="flex rounded-full border border-line p-0.5">
                    {(["mine", "group"] as const).map((v) => (
                      <Link
                        key={v}
                        href={q({ v })}
                        className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", view === v ? "bg-brand-600 text-white" : "text-muted")}
                      >
                        {v === "mine" ? "自分の負担" : "グループ合計"}
                      </Link>
                    ))}
                  </div>
                }
              />
              <div className="px-5 pb-5 pt-4">
                <CategoryDonut data={categoryData} />
              </div>
            </Card>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
            <Card>
              <CardHeader title="メンバー別の立替・負担" description="誰が多く立て替えているか" />
              <div className="px-3 pb-4 pt-4 sm:px-4">
                {memberData.length ? <MemberBars data={memberData} /> : <p className="py-10 text-center text-[13px] text-muted">データがありません</p>}
              </div>
            </Card>
            {!groupId && (
              <Card>
                <CardHeader title="グループ別の支出" />
                <div className="px-3 pb-4 pt-4 sm:px-4">
                  {groupData.length ? <GroupBars data={groupData} /> : <p className="py-10 text-center text-[13px] text-muted">データがありません</p>}
                </div>
              </Card>
            )}
          </div>
        </>
      )}
    </>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-3.5 sm:p-5">
      <p className="text-[11px] font-semibold text-muted sm:text-xs">{label}</p>
      <Amount value={value} className="mt-1 block text-base sm:text-xl" />
    </Card>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-[12px] font-semibold",
        active ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white text-ink-soft hover:bg-canvas",
      )}
    >
      {children}
    </Link>
  );
}
