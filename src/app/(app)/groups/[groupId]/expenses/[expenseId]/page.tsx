import { CalendarDays, History, StickyNote, Wallet } from "lucide-react";
import { Amount, CategoryBadge } from "@/components/app/bits";
import { ExpenseActions } from "@/components/expense/expense-actions";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert, Avatar, Badge } from "@/components/ui/misc";
import { CATEGORIES, SPLIT_METHODS } from "@/lib/constants";
import { formatDateLong, formatDateTime } from "@/lib/dates";
import { formatBp, formatYen } from "@/lib/money";
import { getActivity, getExpenseDetail, getGroupContext, hasConfirmedSettlementAfter } from "@/lib/queries";

export const metadata = { title: "支出の詳細" };

const ACTION_LABEL: Record<string, string> = {
  "expense.created": "登録",
  "expense.updated": "編集",
  "expense.deleted": "削除",
};

export default async function ExpenseDetailPage({ params }: { params: Promise<{ groupId: string; expenseId: string }> }) {
  const { groupId, expenseId } = await params;
  const { supabase, user, people, isAdmin } = await getGroupContext(groupId);
  const [{ expense, splits }, history] = await Promise.all([
    getExpenseDetail(supabase, groupId, expenseId),
    getActivity(supabase, { entityId: expenseId, limit: 50 }),
  ]);
  const settled = await hasConfirmedSettlementAfter(supabase, groupId, expense.created_at);
  const name = (id: string | null) => (id ? (id === user.id ? "あなた" : (people[id]?.display_name ?? "退会したユーザー")) : "—");
  const payer = people[expense.paid_by];
  const canEdit = !expense.deleted_at && (isAdmin || expense.created_by === user.id || expense.paid_by === user.id);
  const myShare = splits.find((s) => s.user_id === user.id)?.share_amount ?? 0;

  return (
    <div className="mx-auto max-w-2xl">
      {expense.deleted_at && (
        <Alert tone="danger" className="mb-4" title="この支出は削除されています">
          {name(expense.updated_by)}が {formatDateTime(expense.deleted_at)} に削除しました。残高の計算には含まれません。
        </Alert>
      )}

      <Card className="p-5 sm:p-6">
        <div className="flex items-start gap-3.5">
          <CategoryBadge category={expense.category} size={48} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-muted">{CATEGORIES[expense.category].label}</p>
            <h1 className="mt-0.5 text-xl font-extrabold tracking-tight text-ink">{expense.title}</h1>
          </div>
        </div>
        <Amount value={expense.amount} className="mt-4 block text-[34px] font-extrabold tracking-tight" />
        <dl className="mt-4 grid gap-3 text-[13px] sm:grid-cols-2">
          <div className="flex items-center gap-2 text-ink-soft">
            <Wallet className="size-4 text-muted" />
            <dt className="sr-only">支払った人</dt>
            <dd className="flex items-center gap-1.5">
              <Avatar name={payer?.display_name ?? "?"} color={payer?.avatar_color ?? "#9aa5a0"} size={20} />
              <span className="font-semibold text-ink">{name(expense.paid_by)}</span>が支払い
            </dd>
          </div>
          <div className="flex items-center gap-2 text-ink-soft">
            <CalendarDays className="size-4 text-muted" />
            <dt className="sr-only">日付</dt>
            <dd>{formatDateLong(expense.spent_on)}</dd>
          </div>
          {expense.memo && (
            <div className="flex items-start gap-2 text-ink-soft sm:col-span-2">
              <StickyNote className="mt-0.5 size-4 text-muted" />
              <dt className="sr-only">メモ</dt>
              <dd className="whitespace-pre-wrap leading-relaxed">{expense.memo}</dd>
            </div>
          )}
        </dl>
        {canEdit && (
          <div className="mt-5 border-t border-line pt-4">
            <ExpenseActions groupId={groupId} expenseId={expense.id} title={expense.title} settled={settled} />
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="負担の内訳"
          description={`${SPLIT_METHODS[expense.split_method].label}で${splits.length}人に割り勘`}
          action={<Badge tone="brand">あなたの負担 {formatYen(myShare)}</Badge>}
        />
        <ul className="mt-2 divide-y divide-line px-5 pb-2">
          {splits.map((s) => {
            const p = people[s.user_id];
            const isPayer = s.user_id === expense.paid_by;
            return (
              <li key={s.id} className="flex items-center gap-3 py-3">
                <Avatar name={p?.display_name ?? "?"} color={p?.avatar_color ?? "#9aa5a0"} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{name(s.user_id)}</p>
                  <p className="text-[11px] text-muted">
                    {isPayer
                      ? "支払った本人"
                      : s.share_amount > 0
                        ? `${name(expense.paid_by)}に ${formatYen(s.share_amount)} を返す`
                        : "負担なし"}
                    {expense.split_method === "percent" && s.input_value !== null && `・${formatBp(s.input_value)}%`}
                  </p>
                </div>
                <span className="num text-[15px] font-bold text-ink">{formatYen(s.share_amount)}</span>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-between border-t border-line px-5 py-3 text-[13px]">
          <span className="text-muted">合計</span>
          <span className="num font-bold text-ink">{formatYen(splits.reduce((a, s) => a + s.share_amount, 0))}</span>
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader title="変更履歴" description="誰が・いつ登録／編集したか" />
        <ol className="mt-2 space-y-3 px-5 pb-5">
          {history.map((h) => {
            const before = (h.metadata?.before ?? null) as { amount?: number; title?: string } | null;
            const after = (h.metadata?.after ?? null) as { amount?: number; title?: string } | null;
            return (
              <li key={h.id} className="flex gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-canvas text-muted">
                  <History className="size-3.5" />
                </span>
                <div className="text-[13px]">
                  <p className="text-ink">
                    <span className="font-semibold">{name(h.actor_id)}</span>が{ACTION_LABEL[h.action] ?? "更新"}
                    <span className="ml-2 text-xs text-muted">{formatDateTime(h.created_at)}</span>
                  </p>
                  {h.action === "expense.updated" && before && after && (
                    <p className="num mt-0.5 text-xs text-muted">
                      {before.amount !== after.amount && `金額 ${formatYen(before.amount ?? 0)} → ${formatYen(after.amount ?? 0)}　`}
                      {before.title !== after.title && `タイトル「${before.title}」→「${after.title}」`}
                      {before.amount === after.amount && before.title === after.title && "内容・負担の割り当てを変更"}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}
