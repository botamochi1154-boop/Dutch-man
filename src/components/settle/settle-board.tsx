"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, BellRing, CalendarClock, CircleCheck, Clock, HandCoins, Info, Undo2 } from "lucide-react";
import { Amount } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { Alert, Avatar, Badge } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { cancelSettlement, confirmSettlement, recordSettlement, rejectSettlement, sendReminder } from "@/lib/actions/settlements";
import { dueLabel, formatDateTime, formatRelative } from "@/lib/dates";
import { formatYen, parseYen } from "@/lib/money";
import type { Transfer } from "@/lib/settle";
import type { ActionResult, BalanceRow, PeopleMap, Settlement } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  groupId: string;
  meId: string;
  isAdmin: boolean;
  people: PeopleMap;
  balances: BalanceRow[];
  plan: Transfer[];
  pending: Settlement[];
  history: Settlement[];
  dueDate: string | null;
}

type Draft = { from: string; to: string; max: number; amountText: string; note: string; requestId: string; mode: "pay" | "receive" };

const STATUS: Record<Settlement["status"], { label: string; tone: "brand" | "info" | "danger" | "neutral" }> = {
  confirmed: { label: "精算済み", tone: "brand" },
  pending: { label: "確認待ち", tone: "info" },
  rejected: { label: "未受領", tone: "danger" },
  cancelled: { label: "取り消し", tone: "neutral" },
};

function newRequestId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16),
      );
}

export function SettleBoard({ groupId, meId, isAdmin, people, balances, plan, pending, history, dueDate }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [voidTarget, setVoidTarget] = useState<Settlement | null>(null);

  const me = balances.find((b) => b.user_id === meId);
  const myEff = me?.effective_balance ?? 0;
  const eff = Object.fromEntries(balances.map((b) => [b.user_id, b.effective_balance]));
  const name = (id: string) => (id === meId ? "あなた" : (people[id]?.display_name ?? "退会したユーザー"));
  const person = (id: string) => people[id] ?? { display_name: "?", avatar_color: "#9aa5a0" };
  const myPays = plan.filter((t) => t.from === meId);
  const myReceives = plan.filter((t) => t.to === meId);
  const due = dueDate ? dueLabel(dueDate) : null;

  function run(key: string, fn: () => Promise<ActionResult>, after?: () => void) {
    setBusy(key);
    startTransition(async () => {
      const r = await fn();
      setBusy(null);
      if (r.ok) {
        if (r.message) toast.success(r.message);
        after?.();
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function openDraft(t: Transfer, mode: Draft["mode"]) {
    const max = Math.min(-(eff[t.from] ?? 0), eff[t.to] ?? 0);
    setDraftError(null);
    setDraft({ from: t.from, to: t.to, max, amountText: String(t.amount), note: "", requestId: newRequestId(), mode });
  }

  function submitDraft() {
    if (!draft) return;
    const amount = parseYen(draft.amountText);
    if (!amount || amount <= 0) return setDraftError("金額を入力してください。");
    if (amount > draft.max) return setDraftError(`未精算の金額（${formatYen(draft.max)}）を超えています。`);
    run(
      "draft",
      () => recordSettlement({ groupId, from: draft.from, to: draft.to, amount, requestId: draft.requestId, note: draft.note }),
      () => setDraft(null),
    );
  }

  return (
    <div className="space-y-4">
      {/* あなたの精算 */}
      <Card className={cn("overflow-hidden", myEff < 0 && "border-[#f1d0cc]", myEff > 0 && "border-brand-200")}>
        <div className={cn("px-5 py-5", myEff < 0 ? "bg-minus-soft/60" : myEff > 0 ? "bg-brand-50/70" : "bg-white")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-ink-soft">あなたの精算</p>
              <p className="mt-1 text-lg font-bold text-ink">
                {myEff < 0 ? "支払う必要があります" : myEff > 0 ? "受け取る予定です" : "精算は完了しています"}
              </p>
            </div>
            {myEff !== 0 ? (
              <Amount value={Math.abs(myEff)} tone={myEff < 0 ? "minus" : "plus"} className="text-[28px] font-extrabold" />
            ) : (
              <CircleCheck className="size-9 text-brand-600" />
            )}
          </div>
          {due && (
            <p
              className={cn(
                "mt-2 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold",
                due.tone === "danger" ? "text-minus" : due.tone === "warn" ? "text-warn" : "text-muted",
              )}
            >
              <CalendarClock className="size-3.5" /> {due.text}
            </p>
          )}
        </div>
        {(myPays.length > 0 || myReceives.length > 0) && (
          <ul className="divide-y divide-line">
            {myPays.map((t) => (
              <li key={`p-${t.to}`} className="flex items-center gap-3 px-5 py-3.5">
                <Avatar name={person(t.to).display_name} color={person(t.to).avatar_color} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{name(t.to)}さんに支払う</p>
                  <Amount value={t.amount} className="text-[15px]" />
                </div>
                <Button size="sm" onClick={() => openDraft(t, "pay")}>
                  <HandCoins /> 支払った
                </Button>
              </li>
            ))}
            {myReceives.map((t) => (
              <li key={`r-${t.from}`} className="flex items-center gap-3 px-5 py-3.5">
                <Avatar name={person(t.from).display_name} color={person(t.from).avatar_color} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{name(t.from)}さんから受け取る</p>
                  <Amount value={t.amount} tone="plus" className="text-[15px]" />
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`${name(t.from)}さんにリマインド`}
                    loading={busy === `remind-${t.from}`}
                    onClick={() => run(`remind-${t.from}`, () => sendReminder(groupId, t.from))}
                  >
                    <BellRing />
                    <span className="hidden sm:inline">リマインド</span>
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => openDraft(t, "receive")}>
                    受け取った
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 確認待ち */}
      {pending.length > 0 && (
        <Card>
          <CardHeader title="確認待ち" description="支払った人が申告し、受け取った人の確認を待っています" />
          <ul className="mt-2 divide-y divide-line">
            {pending.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <PairAvatars from={person(s.from_user)} to={person(s.to_user)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {name(s.from_user)} → {name(s.to_user)}
                  </p>
                  <p className="text-[11px] text-muted">
                    <Clock className="mr-0.5 inline size-3" />
                    {formatRelative(s.created_at)}に申告{s.note && `・${s.note}`}
                  </p>
                </div>
                <Amount value={s.amount} className="text-[15px]" />
                <div className="flex w-full justify-end gap-1.5 sm:w-auto">
                  {s.to_user === meId ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={busy === `reject-${s.id}`}
                        onClick={() => run(`reject-${s.id}`, () => rejectSettlement(groupId, s.id))}
                      >
                        受け取っていない
                      </Button>
                      <Button size="sm" loading={busy === `confirm-${s.id}`} onClick={() => run(`confirm-${s.id}`, () => confirmSettlement(groupId, s.id))}>
                        受け取りを確認
                      </Button>
                    </>
                  ) : s.from_user === meId ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={busy === `cancel-${s.id}`}
                      onClick={() => run(`cancel-${s.id}`, () => cancelSettlement(groupId, s.id))}
                    >
                      申告を取り消す
                    </Button>
                  ) : (
                    <Badge tone="info">確認待ち</Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        {/* 精算プラン */}
        <Card>
          <CardHeader
            title="精算プラン（全員）"
            description={plan.length ? `送金 ${plan.length} 回で全員の精算が完了します（最少回数）` : undefined}
          />
          {plan.length === 0 ? (
            <div className="mx-5 my-4 flex items-center gap-3 rounded-xl bg-brand-50 px-4 py-4">
              <CircleCheck className="size-6 text-brand-600" />
              <p className="text-sm font-bold text-brand-800">
                {pending.length ? "確認待ちの精算が完了すれば終わりです" : "全員の精算が完了しています"}
              </p>
            </div>
          ) : (
            <ul className="mt-2 space-y-2 px-5 pb-5">
              {plan.map((t) => {
                const mine = t.from === meId || t.to === meId;
                return (
                  <li key={`${t.from}-${t.to}`} className={cn("flex items-center gap-3 rounded-xl px-3.5 py-3", mine ? "bg-brand-50" : "bg-canvas")}>
                    <PairAvatars from={person(t.from)} to={person(t.to)} />
                    <p className="min-w-0 flex-1 truncate text-[13px] text-ink-soft">
                      <span className="font-semibold text-ink">{name(t.from)}</span> が <span className="font-semibold text-ink">{name(t.to)}</span> に
                    </p>
                    <Amount value={t.amount} className="text-[15px]" />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* メンバーの残高 */}
        <Card>
          <CardHeader title="メンバーの残高" description="残高＝立替 − 負担 ± 精算済み" />
          <div className="mt-2 overflow-x-auto px-2 pb-3">
            <table className="w-full min-w-[420px] text-[13px]">
              <thead>
                <tr className="text-left text-[11px] text-muted">
                  <th className="px-3 py-2 font-semibold">メンバー</th>
                  <th className="px-3 py-2 text-right font-semibold">立替</th>
                  <th className="px-3 py-2 text-right font-semibold">負担</th>
                  <th className="px-3 py-2 text-right font-semibold">精算</th>
                  <th className="px-3 py-2 text-right font-semibold">残高</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {balances
                  .slice()
                  .sort((a, b) => b.effective_balance - a.effective_balance)
                  .map((b) => (
                    <tr key={b.user_id}>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2">
                          <Avatar name={person(b.user_id).display_name} color={person(b.user_id).avatar_color} size={24} />
                          <span className="truncate font-semibold text-ink">{name(b.user_id)}</span>
                        </span>
                      </td>
                      <td className="num px-3 py-2.5 text-right text-ink-soft">{formatYen(b.paid)}</td>
                      <td className="num px-3 py-2.5 text-right text-ink-soft">{formatYen(b.share)}</td>
                      <td className="num px-3 py-2.5 text-right text-ink-soft">
                        {formatYen(b.sent - b.received + b.pending_out - b.pending_in, { sign: true })}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="inline-flex items-center gap-1.5">
                          <Amount value={b.effective_balance} sign tone="auto" />
                          {b.user_id !== meId && b.effective_balance < 0 && myEff > 0 && (
                            <button
                              className="rounded-md p-1 text-muted hover:bg-canvas hover:text-ink"
                              title="リマインドを送る"
                              aria-label={`${name(b.user_id)}さんにリマインド`}
                              onClick={() => run(`remind-${b.user_id}`, () => sendReminder(groupId, b.user_id))}
                            >
                              <BellRing className="size-3.5" />
                            </button>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* 履歴 */}
      <Card>
        <CardHeader title="精算履歴" description="申告・確認・取り消しの記録" />
        {history.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-muted">まだ精算の記録はありません</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {history.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                <PairAvatars from={person(s.from_user)} to={person(s.to_user)} small />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-ink">
                    {name(s.from_user)} → {name(s.to_user)}
                  </p>
                  <p className="text-[11px] text-muted">
                    {formatDateTime(s.confirmed_at ?? s.decided_at ?? s.created_at)}
                    {s.note && `・${s.note}`}
                  </p>
                </div>
                <Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge>
                <Amount value={s.amount} tone={s.status === "confirmed" ? "neutral" : "muted"} className={cn("text-sm", s.status !== "confirmed" && "line-through")} />
                {s.status === "confirmed" && (s.to_user === meId || isAdmin) && (
                  <button
                    onClick={() => setVoidTarget(s)}
                    className="rounded-lg p-1.5 text-muted hover:bg-canvas hover:text-ink"
                    aria-label="この精算記録を取り消す"
                    title="記録を取り消す"
                  >
                    <Undo2 className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="flex items-start gap-1.5 px-1 text-[11px] leading-relaxed text-muted">
        <Info className="mt-px size-3.5 shrink-0" />
        WariNote は支払い状況を記録・共有するアプリです。実際の送金（現金・銀行振込・送金アプリなど）は各自で行い、完了したらここで記録してください。
      </p>

      <Dialog
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.mode === "pay" ? `${draft ? name(draft.to) : ""}さんへの支払い` : `${draft ? name(draft.from) : ""}さんからの受け取り`}
        description={
          draft?.mode === "pay"
            ? "支払いが済んだら申告してください。相手が「受け取りを確認」すると精算済みになります。"
            : "受け取った金額を記録します。記録するとすぐに精算済みになります。"
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setDraft(null)}>
              キャンセル
            </Button>
            <Button loading={busy === "draft"} onClick={submitDraft}>
              {draft?.mode === "pay" ? "支払いを申告する" : "受け取りを記録する"}
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3 rounded-2xl bg-canvas py-4">
              <Avatar name={person(draft.from).display_name} color={person(draft.from).avatar_color} size={40} />
              <ArrowRight className="size-5 text-muted" />
              <Avatar name={person(draft.to).display_name} color={person(draft.to).avatar_color} size={40} />
            </div>
            <Field label="金額" htmlFor="settle-amount" hint={`一部だけの支払いも記録できます（最大 ${formatYen(draft.max)}）`}>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">¥</span>
                <Input
                  id="settle-amount"
                  inputMode="numeric"
                  value={draft.amountText}
                  onChange={(e) => setDraft({ ...draft, amountText: e.target.value.replace(/[^\d０-９,，]/g, "") })}
                  className="num pl-8 text-lg font-bold"
                />
              </div>
            </Field>
            <Field label="メモ" htmlFor="settle-note" optional>
              <Input
                id="settle-note"
                maxLength={200}
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                placeholder="例：PayPayで送金、現金で手渡し"
              />
            </Field>
            {draftError && <Alert tone="danger">{draftError}</Alert>}
          </div>
        )}
      </Dialog>

      <Dialog
        open={!!voidTarget}
        onClose={() => setVoidTarget(null)}
        title="この精算記録を取り消しますか？"
        description="誤って記録した場合に使います。取り消すと、その金額は未精算に戻ります。"
        footer={
          <>
            <Button variant="outline" onClick={() => setVoidTarget(null)}>
              やめる
            </Button>
            <Button
              variant="danger"
              loading={busy === "void"}
              onClick={() => voidTarget && run("void", () => cancelSettlement(groupId, voidTarget.id), () => setVoidTarget(null))}
            >
              取り消す
            </Button>
          </>
        }
      />
    </div>
  );
}

function PairAvatars({
  from,
  to,
  small,
}: {
  from: { display_name: string; avatar_color: string };
  to: { display_name: string; avatar_color: string };
  small?: boolean;
}) {
  const s = small ? 24 : 30;
  return (
    <span className="flex shrink-0 items-center gap-1">
      <Avatar name={from.display_name} color={from.avatar_color} size={s} />
      <ArrowRight className="size-3.5 text-muted" />
      <Avatar name={to.display_name} color={to.avatar_color} size={s} />
    </span>
  );
}
