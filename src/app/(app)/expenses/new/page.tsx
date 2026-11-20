import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Users } from "lucide-react";
import { GroupBadge, PageHeader } from "@/components/app/bits";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { getOverview, requireUser } from "@/lib/queries";

export const metadata = { title: "支出を追加" };

/** 下部タブの「＋」から：グループが1つならそのまま入力画面へ、複数なら選択 */
export default async function PickGroupForExpense() {
  const { supabase } = await requireUser();
  const overview = await getOverview(supabase);
  if (overview.length === 1) redirect(`/groups/${overview[0].group_id}/expenses/new`);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="支出を追加" description="どのグループの支出ですか？" />
      {overview.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users />}
            title="先にグループを作りましょう"
            action={
              <Link href="/groups/new" className={buttonVariants({})}>
                グループを作成
              </Link>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {overview.map((g) => (
              <li key={g.group_id}>
                <Link href={`/groups/${g.group_id}/expenses/new`} className="flex items-center gap-3 px-5 py-4 hover:bg-canvas/70">
                  <GroupBadge icon={g.icon} color={g.color} size={40} />
                  <span className="flex-1 text-[15px] font-semibold text-ink">{g.name}</span>
                  <span className="text-xs text-muted">{g.member_count}人</span>
                  <ChevronRight className="size-4 text-line" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
