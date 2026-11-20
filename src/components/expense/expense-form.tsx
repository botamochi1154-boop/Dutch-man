"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { Check, Equal, Info, Percent, Users, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Alert, Avatar } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { saveExpense } from "@/lib/actions/expenses";
import { CATEGORIES, CATEGORY_KEYS, SPLIT_METHODS } from "@/lib/constants";
import { formatBp, formatYen, MAX_AMOUNT, parsePercentToBp, parseYen } from "@/lib/money";
import { computeSplit, evenPercents } from "@/lib/split";
import type { Category, SplitMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface FormMember {
  userId: string;
  name: string;
  color: string;
}

export interface ExpenseInitial {
  expenseId: string;
  updatedAt: string;
  title: string;
  amount: number;
  paidBy: string;
  category: Category;
  spentOn: string;
  memo: string;
  splitMethod: SplitMethod;
  participants: string[];
  values: Record<string, number>;
}

const SPLIT_ERRORS: Record<string, string> = {
  INVALID_AMOUNT: "金額を入力してください",
  NO_PARTICIPANTS: "割り勘の対象者を選んでください",
  INVALID_SPLIT: "金額・割合をすべて入力してください",
  SPLIT_SUM_MISMATCH: "金額の合計が支出額と一致していません",
  PERCENT_SUM_MISMATCH: "割合の合計を100%にしてください",
  DUPLICATE_PARTICIPANT: "対象者が重複しています",
};

export function ExpenseForm({
  groupId,
  meId,
  members,
  today,
  initial,
  settledWarning,
}: {
  groupId: string;
  meId: string;
  /** 参加日時順（＝端数配分の優先順）に並んだメンバー */
  members: FormMember[];
  today: string;
  initial?: ExpenseInitial;
  settledWarning?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [amountText, setAmountText] = useState(initial ? initial.amount.toLocaleString("ja-JP") : "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState<Category>(initial?.category ?? "food");
  const [paidBy, setPaidBy] = useState(initial?.paidBy ?? meId);
  const [spentOn, setSpentOn] = useState(initial?.spentOn ?? today);
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [method, setMethod] = useState<SplitMethod>(initial?.splitMethod ?? "equal");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initial?.participants ?? members.map((m) => m.userId)),
  );
  const [exactText, setExactText] = useState<Record<string, string>>(() =>
    initial?.splitMethod === "exact" ? mapValues(initial.values, String) : {},
  );
  const [percentText, setPercentText] = useState<Record<string, string>>(() =>
    initial?.splitMethod === "percent" ? mapValues(initial.values, formatBp) : {},
  );
  const [confirmSettled, setConfirmSettled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const amount = parseYen(amountText);
  const amountValid = amount !== null && amount > 0 && amount <= MAX_AMOUNT;
  const participants = members.filter((m) => selected.has(m.userId)).map((m) => m.userId);
  const values = participants.map((id) =>
    method === "exact" ? parseYen(exactText[id] ?? "") : method === "percent" ? parsePercentToBp(percentText[id] ?? "") : null,
  );

  const result = useMemo(
    () =>
      amountValid
        ? computeSplit({ amount: amount!, method, participants, values, payerId: paidBy })
        : ({ ok: false, error: "INVALID_AMOUNT" } as const),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [amount, amountValid, method, participants.join(","), values.join(","), paidBy],
  );
  const shareOf = (id: string) => (result.ok ? result.shares.find((s) => s.userId === id)?.share : undefined);

  const exactSum = values.reduce<number>((s, v) => s + (method === "exact" ? (v ?? 0) : 0), 0);
  const percentSum = values.reduce<number>((s, v) => s + (method === "percent" ? (v ?? 0) : 0), 0);
  const payer = members.find((m) => m.userId === paidBy);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function distributeEvenly() {
    if (!participants.length) return;
    if (method === "percent") {
      const bps = evenPercents(participants.length);
      setPercentText(Object.fromEntries(participants.map((id, i) => [id, formatBp(bps[i])])));
    } else if (method === "exact" && amountValid) {
      const r = computeSplit({ amount: amount!, method: "equal", participants, payerId: paidBy });
      if (r.ok) setExactText(Object.fromEntries(r.shares.map((s) => [s.userId, String(s.share)])));
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (!title.trim()) return setError("タイトルを入力してください。");
    if (!amountValid) return setError("金額を正しく入力してください（1円〜1億円、整数）。");
    if (!result.ok) return setError(SPLIT_ERRORS[result.error] ?? "割り勘の設定を確認してください。");
    if (settledWarning && !confirmSettled) return setError("「精算済みでも変更する」にチェックを入れてください。");

    startTransition(async () => {
      const r = await saveExpense({
        groupId,
        expenseId: initial?.expenseId,
        expectedUpdatedAt: initial?.updatedAt,
        confirmSettled,
        title: title.trim(),
        amount: amount!,
        paidBy,
        category,
        spentOn,
        memo,
        splitMethod: method,
        participants,
        values: method === "equal" ? null : (values as number[]),
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      toast.success(r.message ?? "保存しました");
      router.push(initial ? `/groups/${groupId}/expenses/${initial.expenseId}` : `/groups/${groupId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start [&>*]:min-w-0">
        <div className="space-y-4">
          <Card className="p-5">
            <label htmlFor="amount" className="text-[13px] font-semibold text-ink-soft">
              金額
            </label>
            <div
              className={cn(
                "mt-2 flex items-baseline gap-1.5 border-b-2 pb-1.5 transition-colors focus-within:border-brand-500",
                touched && !amountValid ? "border-minus" : "border-line",
              )}
            >
              <span className="text-2xl font-bold text-muted">¥</span>
              <input
                id="amount"
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value.replace(/[^\d０-９,，]/g, ""))}
                onFocus={() => amount !== null && setAmountText(String(amount))}
                onBlur={() => amount !== null && setAmountText(amount.toLocaleString("ja-JP"))}
                className="num w-full bg-transparent text-[34px] font-extrabold tracking-tight text-ink outline-none placeholder:text-line"
                aria-invalid={touched && !amountValid}
              />
            </div>
            {touched && !amountValid && <p className="mt-1.5 text-xs font-medium text-minus">1円〜1億円の整数で入力してください</p>}

            <Field label="タイトル" htmlFor="title" className="mt-5">
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={60}
                placeholder="例：ホテル代、レンタカー、夕食"
                aria-invalid={touched && !title.trim()}
              />
            </Field>
          </Card>

          <Card className="p-5">
            <p className="text-[13px] font-semibold text-ink-soft">支払った人</p>
            <div className="scrollbar-none -mx-5 mt-2.5 flex gap-2 overflow-x-auto px-5 pb-1">
              {members.map((m) => {
                const active = paidBy === m.userId;
                return (
                  <button
                    key={m.userId}
                    type="button"
                    onClick={() => setPaidBy(m.userId)}
                    aria-pressed={active}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-[13px] font-semibold transition",
                      active ? "border-brand-500 bg-brand-50 text-brand-800" : "border-line text-ink-soft hover:bg-canvas",
                    )}
                  >
                    <Avatar name={m.name} color={m.color} size={26} />
                    {m.userId === meId ? "あなた" : m.name}
                    {active && <Check className="size-4 text-brand-600" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>

            <p className="mt-5 text-[13px] font-semibold text-ink-soft">カテゴリ</p>
            <div className="mt-2.5 grid grid-cols-4 gap-2">
              {CATEGORY_KEYS.map((k) => {
                const c = CATEGORIES[k];
                const I = c.icon;
                const active = category === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setCategory(k)}
                    aria-pressed={active}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[11px] font-semibold transition",
                      active ? "border-transparent text-ink" : "border-line text-ink-soft hover:bg-canvas",
                    )}
                    style={active ? { backgroundColor: `${c.color}1c`, boxShadow: `inset 0 0 0 1.5px ${c.color}` } : undefined}
                  >
                    <I className="size-5" style={{ color: c.color }} />
                    {c.label}
                  </button>
                );
              })}
            </div>

            <Field label="日付" htmlFor="spent_on" className="mt-5">
              <Input id="spent_on" type="date" value={spentOn} max="2100-12-31" onChange={(e) => setSpentOn(e.target.value)} />
            </Field>
            <Field label="メモ" htmlFor="memo" optional className="mt-4">
              <Textarea id="memo" value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={500} className="min-h-20" placeholder="例：2泊分・朝食込み" />
            </Field>
          </Card>
        </div>

        <Card className="p-5 lg:sticky lg:top-6">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-ink-soft">割り勘</p>
            <span className="text-xs text-muted">{participants.length}人で分ける</span>
          </div>
          <div className="mt-2.5 grid grid-cols-3 rounded-xl bg-canvas p-1" role="radiogroup" aria-label="割り勘の方法">
            {(Object.keys(SPLIT_METHODS) as SplitMethod[]).map((k) => {
              const I = k === "equal" ? Equal : k === "exact" ? Users : Percent;
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={method === k}
                  onClick={() => setMethod(k)}
                  className={cn(
                    "flex h-9 items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold transition",
                    method === k ? "bg-white text-ink shadow-sm" : "text-muted",
                  )}
                >
                  <I className="size-4" />
                  {SPLIT_METHODS[k].label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted">{SPLIT_METHODS[method].hint}</p>

          <ul className="mt-3 divide-y divide-line">
            {members.map((m) => {
              const on = selected.has(m.userId);
              const share = shareOf(m.userId);
              return (
                <li key={m.userId} className="flex items-center gap-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggle(m.userId)}
                    aria-pressed={on}
                    aria-label={`${m.name}を割り勘の対象に${on ? "しない" : "する"}`}
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition",
                      on ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white",
                    )}
                  >
                    {on && <Check className="size-4" strokeWidth={3} />}
                  </button>
                  <Avatar name={m.name} color={m.color} size={30} className={cn(!on && "opacity-40")} />
                  <span className={cn("min-w-0 flex-1 truncate text-sm font-medium", on ? "text-ink" : "text-muted")}>
                    {m.userId === meId ? "あなた" : m.name}
                    {m.userId === paidBy && <span className="ml-1.5 text-[11px] font-semibold text-brand-700">支払者</span>}
                  </span>

                  {method === "exact" && on ? (
                    <div className="relative w-28">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">¥</span>
                      <Input
                        inputMode="numeric"
                        value={exactText[m.userId] ?? ""}
                        onChange={(e) => setExactText((p) => ({ ...p, [m.userId]: e.target.value.replace(/[^\d０-９,，]/g, "") }))}
                        className="num h-10 pl-7 text-right text-sm"
                        aria-label={`${m.name}の負担額`}
                      />
                    </div>
                  ) : method === "percent" && on ? (
                    <div className="flex items-center gap-2">
                      <span className="num w-16 text-right text-[11px] text-muted">{share !== undefined ? formatYen(share) : ""}</span>
                      <div className="relative w-20">
                        <Input
                          inputMode="decimal"
                          value={percentText[m.userId] ?? ""}
                          onChange={(e) => setPercentText((p) => ({ ...p, [m.userId]: e.target.value.replace(/[^\d.０-９．]/g, "") }))}
                          className="num h-10 pr-7 text-right text-sm"
                          aria-label={`${m.name}の割合`}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">%</span>
                      </div>
                    </div>
                  ) : (
                    <span className={cn("num text-sm font-bold", on ? "text-ink" : "text-line")}>
                      {on && share !== undefined ? formatYen(share) : on ? "—" : "対象外"}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex gap-2">
              <button type="button" className="text-xs font-semibold text-brand-700" onClick={() => setSelected(new Set(members.map((m) => m.userId)))}>
                全員を選択
              </button>
              {method !== "equal" && (
                <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700" onClick={distributeEvenly}>
                  <WandSparkles className="size-3.5" /> 均等に入力
                </button>
              )}
            </div>
            {method === "exact" && amountValid && (
              <span className={cn("num text-xs font-semibold", exactSum === amount ? "text-brand-700" : "text-minus")}>
                {exactSum === amount ? "合計一致" : `残り ${formatYen(amount! - exactSum)}`}
              </span>
            )}
            {method === "percent" && (
              <span className={cn("num text-xs font-semibold", percentSum === 10000 ? "text-brand-700" : "text-minus")}>
                合計 {formatBp(percentSum)}%
              </span>
            )}
          </div>

          {result.ok && payer && (
            <div className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-[13px] leading-relaxed text-brand-900">
              <p className="font-semibold">
                {paidBy === meId ? "あなた" : `${payer.name}さん`}が {formatYen(amount!)} を立て替え
              </p>
              <p className="mt-0.5 text-brand-800">
                {(() => {
                  const owed = result.shares.filter((s) => s.userId !== paidBy).reduce((a, s) => a + s.share, 0);
                  return owed > 0
                    ? `他のメンバーから合計 ${formatYen(owed)} を受け取る予定になります`
                    : "全額を支払った本人が負担します";
                })()}
              </p>
            </div>
          )}
          {!result.ok && amountValid && result.error !== "INVALID_AMOUNT" && (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-minus">
              <Info className="size-3.5" /> {SPLIT_ERRORS[result.error]}
            </p>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            端数（1円未満）が出る場合は、支払った人 → 参加した順に1円ずつ割り当て、合計が必ず一致するようにしています。
          </p>
        </Card>
      </div>

      {settledWarning && (
        <Alert tone="warn" className="mt-4" title="この支出は精算済みの期間に含まれています">
          <p>変更すると全員の残高が再計算され、新たに精算が必要になる場合があります。</p>
          <label className="mt-2 flex cursor-pointer items-center gap-2 font-semibold">
            <input type="checkbox" checked={confirmSettled} onChange={(e) => setConfirmSettled(e.target.checked)} className="size-4 accent-brand-600" />
            精算済みでも変更する
          </label>
        </Alert>
      )}

      {error && (
        <Alert tone="danger" className="mt-4">
          {error}
        </Alert>
      )}

      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 mt-5 lg:bottom-6">
        <Button type="submit" size="lg" className="w-full shadow-lg lg:ml-auto lg:flex lg:w-72" loading={pending}>
          {initial ? "変更を保存" : "支出を登録"}
        </Button>
      </div>
    </form>
  );
}

function mapValues<T>(obj: Record<string, number>, fn: (n: number) => T): Record<string, T> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v)]));
}
