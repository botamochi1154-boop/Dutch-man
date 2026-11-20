/**
 * 精算プランの計算（送金回数の最小化）
 *
 * 残高: 正 = 受け取る / 負 = 支払う。合計は 0。
 *
 * 1. 残高が 0 でない人が 15 人以下なら、ビットマスク DP で
 *    「合計 0 になる部分集合」への最大分割を求める。
 *    各部分集合（k 人）は k−1 回の送金で精算できるので、
 *    送金回数 = 人数 − 部分集合の数 が理論上の最小となる。
 * 2. 16 人以上は貪欲法（大きい債務者 × 大きい債権者）で最大 n−1 回。
 */

export interface BalanceEntry {
  userId: string;
  balance: number;
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

const EXACT_LIMIT = 15;

export function planSettlements(entries: BalanceEntry[]): Transfer[] {
  const items = entries
    .filter((e) => e.balance !== 0)
    .map((e) => ({ userId: e.userId, balance: e.balance }))
    .sort((a, b) => (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0));

  const total = items.reduce((s, e) => s + e.balance, 0);
  if (total !== 0) {
    throw new Error(`残高の合計が0ではありません（${total}）`);
  }
  if (items.length === 0) return [];

  const groups = items.length <= EXACT_LIMIT ? partitionZeroSum(items) : [items];
  const transfers: Transfer[] = [];
  for (const g of groups) transfers.push(...greedy(g));
  return transfers.sort((a, b) => b.amount - a.amount || cmp(a.from, b.from) || cmp(a.to, b.to));
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 合計 0 の部分集合へ、個数が最大になるよう分割する */
function partitionZeroSum(items: BalanceEntry[]): BalanceEntry[][] {
  const n = items.length;
  const full = (1 << n) - 1;
  const sum = new Array<number>(1 << n).fill(0);
  const dp = new Int8Array(1 << n);

  for (let mask = 1; mask <= full; mask++) {
    const low = mask & -mask;
    const i = 31 - Math.clz32(low);
    sum[mask] = sum[mask ^ low] + items[i].balance;
    let best = 0;
    for (let m = mask; m; m &= m - 1) {
      const bit = m & -m;
      const v = dp[mask ^ bit];
      if (v > best) best = v;
    }
    dp[mask] = best + (sum[mask] === 0 ? 1 : 0);
  }

  // 復元：末尾要素を1つずつ取り除いて並び順を作る
  const orderRev: number[] = [];
  let mask = full;
  while (mask) {
    const need = dp[mask] - (sum[mask] === 0 ? 1 : 0);
    let chosen = -1;
    for (let m = mask; m; m &= m - 1) {
      const bit = m & -m;
      if (dp[mask ^ bit] === need) {
        chosen = 31 - Math.clz32(bit);
        break;
      }
    }
    orderRev.push(chosen);
    mask ^= 1 << chosen;
  }
  const order = orderRev.reverse();

  // 累積和が 0 になる位置で区切る
  const groups: BalanceEntry[][] = [];
  let cur: BalanceEntry[] = [];
  let acc = 0;
  for (const idx of order) {
    cur.push(items[idx]);
    acc += items[idx].balance;
    if (acc === 0) {
      groups.push(cur);
      cur = [];
    }
  }
  if (cur.length) groups.push(cur);
  return groups;
}

/** 合計 0 の集合を、大きい順に組み合わせて精算する（最大 k−1 回） */
function greedy(group: BalanceEntry[]): Transfer[] {
  const debtors = group
    .filter((e) => e.balance < 0)
    .map((e) => ({ id: e.userId, amt: -e.balance }))
    .sort((a, b) => b.amt - a.amt || cmp(a.id, b.id));
  const creditors = group
    .filter((e) => e.balance > 0)
    .map((e) => ({ id: e.userId, amt: e.balance }))
    .sort((a, b) => b.amt - a.amt || cmp(a.id, b.id));

  const out: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const x = Math.min(debtors[i].amt, creditors[j].amt);
    if (x > 0) out.push({ from: debtors[i].id, to: creditors[j].id, amount: x });
    debtors[i].amt -= x;
    creditors[j].amt -= x;
    if (debtors[i].amt === 0) i++;
    if (creditors[j].amt === 0) j++;
  }
  return out;
}

/** 送金を適用した後の残高（テスト・検証用） */
export function applyTransfers(entries: BalanceEntry[], transfers: Transfer[]): Map<string, number> {
  const m = new Map(entries.map((e) => [e.userId, e.balance]));
  for (const t of transfers) {
    m.set(t.from, (m.get(t.from) ?? 0) + t.amount);
    m.set(t.to, (m.get(t.to) ?? 0) - t.amount);
  }
  return m;
}
