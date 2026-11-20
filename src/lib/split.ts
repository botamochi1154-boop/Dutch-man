/**
 * 割り勘計算。DB 側の private.compute_split と同一アルゴリズム（自動テストで一致を検証）。
 *
 * - 金額は円の整数、割合は bp（1% = 100）の整数。浮動小数点は使わない。
 * - 端数配分の優先順は「支払者 → 引数の並び順（= 参加日時順）」。
 * - 結果の負担額の合計は必ず支出額と一致する。
 */

export type SplitMethod = "equal" | "exact" | "percent";

export type SplitErrorCode =
  | "INVALID_AMOUNT"
  | "NO_PARTICIPANTS"
  | "DUPLICATE_PARTICIPANT"
  | "INVALID_SPLIT"
  | "SPLIT_SUM_MISMATCH"
  | "PERCENT_SUM_MISMATCH";

export interface SplitShare {
  userId: string;
  share: number;
  /** exact: 指定額 / percent: bp / equal: null */
  inputValue: number | null;
}

export type SplitResult =
  | { ok: true; shares: SplitShare[] }
  | { ok: false; error: SplitErrorCode };

export interface SplitInput {
  amount: number;
  method: SplitMethod;
  /** 参加日時順に並んだ割り勘対象者 */
  participants: string[];
  /** exact / percent のときの値（participants と同じ並び） */
  values?: (number | null)[];
  payerId: string;
}

/** 支払者を先頭にし、それ以外は元の順序を保つ（values も同じ並びに揃える） */
export function orderForSplit(
  participants: string[],
  values: (number | null)[] | undefined,
  payerId: string,
): { participants: string[]; values: (number | null)[] } {
  const idx = participants.map((_, i) => i);
  idx.sort((a, b) => {
    const pa = participants[a] === payerId ? 0 : 1;
    const pb = participants[b] === payerId ? 0 : 1;
    return pa - pb || a - b;
  });
  return {
    participants: idx.map((i) => participants[i]),
    values: idx.map((i) => (values ? values[i] ?? null : null)),
  };
}

/** 並び順をそのまま端数の優先順として計算する（DB の private.compute_split と同じ） */
export function computeSplitOrdered(
  amount: number,
  method: SplitMethod,
  participants: string[],
  values: (number | null)[] | null,
): SplitResult {
  const n = participants.length;
  if (!Number.isSafeInteger(amount) || amount <= 0) return { ok: false, error: "INVALID_AMOUNT" };
  if (n === 0 || participants.some((p) => !p)) return { ok: false, error: "NO_PARTICIPANTS" };
  if (new Set(participants).size !== n) return { ok: false, error: "DUPLICATE_PARTICIPANT" };

  const shares: number[] = new Array(n).fill(0);

  if (method === "equal") {
    const left = amount % n;
    const base = (amount - left) / n;
    for (let i = 0; i < n; i++) shares[i] = base + (i < left ? 1 : 0);
  } else if (method === "exact") {
    if (!values || values.length !== n) return { ok: false, error: "INVALID_SPLIT" };
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const v = values[i];
      if (v === null || v === undefined || !Number.isSafeInteger(v) || v < 0) return { ok: false, error: "INVALID_SPLIT" };
      shares[i] = v;
      sum += v;
    }
    if (sum !== amount) return { ok: false, error: "SPLIT_SUM_MISMATCH" };
  } else if (method === "percent") {
    if (!values || values.length !== n) return { ok: false, error: "INVALID_SPLIT" };
    const rems: number[] = new Array(n).fill(0);
    let bpSum = 0;
    let total = 0;
    for (let i = 0; i < n; i++) {
      const v = values[i];
      if (v === null || v === undefined || !Number.isSafeInteger(v) || v < 0 || v > 10000) {
        return { ok: false, error: "INVALID_SPLIT" };
      }
      bpSum += v;
      const raw = amount * v; // 最大 1e8 * 1e4 = 1e12（安全な整数範囲）
      rems[i] = raw % 10000;
      shares[i] = (raw - rems[i]) / 10000;
      total += shares[i];
    }
    if (bpSum !== 10000) return { ok: false, error: "PERCENT_SUM_MISMATCH" };
    const left = amount - total;
    const order = rems.map((r, i) => ({ r, i })).sort((a, b) => b.r - a.r || a.i - b.i);
    for (let k = 0; k < left; k++) shares[order[k].i] += 1;
  } else {
    return { ok: false, error: "INVALID_SPLIT" };
  }

  return {
    ok: true,
    shares: participants.map((userId, i) => ({
      userId,
      share: shares[i],
      inputValue: method === "equal" ? null : (values?.[i] ?? null),
    })),
  };
}

/** 画面用：支払者を先頭にして計算する */
export function computeSplit(input: SplitInput): SplitResult {
  const ordered = orderForSplit(input.participants, input.values, input.payerId);
  return computeSplitOrdered(
    input.amount,
    input.method,
    ordered.participants,
    input.method === "equal" ? null : ordered.values,
  );
}

/** 割合を均等に配る初期値（bp）。合計が必ず 10000 になる */
export function evenPercents(n: number): number[] {
  if (n <= 0) return [];
  const left = 10000 % n;
  const base = (10000 - left) / n;
  return Array.from({ length: n }, (_, i) => base + (i < left ? 1 : 0));
}
