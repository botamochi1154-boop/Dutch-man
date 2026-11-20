import { test } from "node:test";
import assert from "node:assert/strict";
import { planSettlements, applyTransfers, type BalanceEntry } from "../src/lib/settle";

test("仕様例：A +8,000 / B −5,000 / C −3,000 → B→A 5,000, C→A 3,000", () => {
  const t = planSettlements([
    { userId: "A", balance: 8000 },
    { userId: "B", balance: -5000 },
    { userId: "C", balance: -3000 },
  ]);
  assert.deepEqual(t, [
    { from: "B", to: "A", amount: 5000 },
    { from: "C", to: "A", amount: 3000 },
  ]);
});

test("沖縄旅行：A +10,000 / B +2,000 / C −2,000 / D −10,000 → 2回で精算", () => {
  const t = planSettlements([
    { userId: "A", balance: 10000 },
    { userId: "B", balance: 2000 },
    { userId: "C", balance: -2000 },
    { userId: "D", balance: -10000 },
  ]);
  assert.deepEqual(t, [
    { from: "D", to: "A", amount: 10000 },
    { from: "C", to: "B", amount: 2000 },
  ]);
});

test("貪欲法では3回になるケースもDPで最小2回にする", () => {
  // 貪欲：A(-6)→D(+5), A(-1)→E(+4)... と分割され3回以上になりうる配置
  const entries: BalanceEntry[] = [
    { userId: "a", balance: -6 }, { userId: "b", balance: -4 }, { userId: "c", balance: -3 },
    { userId: "d", balance: 6 }, { userId: "e", balance: 4 }, { userId: "f", balance: 3 },
  ];
  const t = planSettlements(entries);
  assert.equal(t.length, 3); // 3組の完全一致 → 3回（6人なら最小）
  for (const [, v] of applyTransfers(entries, t)) assert.equal(v, 0);
});

test("全員0なら送金なし", () => {
  assert.deepEqual(planSettlements([{ userId: "a", balance: 0 }, { userId: "b", balance: 0 }]), []);
});

test("合計が0でなければ例外", () => {
  assert.throws(() => planSettlements([{ userId: "a", balance: 1 }]));
});

/** 総当たりで求めた最小送金回数（検証用・小規模のみ） */
function bruteMinTransfers(values: number[]): number {
  const n = values.length;
  let best = 0;
  // 最大分割数 = 合計0部分集合への分割数の最大値
  const memo = new Map<number, number>();
  const sumOf = (mask: number) => values.reduce((s, v, i) => (mask & (1 << i) ? s + v : s), 0);
  const go = (mask: number): number => {
    if (mask === 0) return 0;
    if (memo.has(mask)) return memo.get(mask)!;
    const low = mask & -mask;
    let r = -Infinity;
    for (let sub = mask; sub; sub = (sub - 1) & mask) {
      if (!(sub & low)) continue;
      if (sumOf(sub) === 0) r = Math.max(r, 1 + go(mask ^ sub));
    }
    memo.set(mask, r);
    return r;
  };
  best = go((1 << n) - 1);
  return n - best;
}

test("ランダム3,000件：精算後は全員0、回数は理論上の最小と一致", () => {
  let seed = 7;
  const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2147483648), seed % n);
  for (let t = 0; t < 3000; t++) {
    const n = 2 + rnd(8);
    const vals = Array.from({ length: n - 1 }, () => (rnd(2) ? 1 : -1) * (rnd(6) + 1) * 1000);
    vals.push(-vals.reduce((a, b) => a + b, 0));
    const entries = vals.map((balance, i) => ({ userId: `u${i}`, balance }));
    const transfers = planSettlements(entries);
    for (const [, v] of applyTransfers(entries, transfers)) assert.equal(v, 0);
    for (const tr of transfers) assert.ok(tr.amount > 0 && Number.isInteger(tr.amount));
    const nonzero = vals.filter((v) => v !== 0);
    assert.equal(transfers.length, nonzero.length ? bruteMinTransfers(nonzero) : 0);
  }
});

test("大人数（30人）でも貪欲法で n−1 回以内", () => {
  let seed = 99;
  const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2147483648), seed % n);
  const vals = Array.from({ length: 29 }, () => rnd(200001) - 100000);
  vals.push(-vals.reduce((a, b) => a + b, 0));
  const entries = vals.map((balance, i) => ({ userId: `u${String(i).padStart(2, "0")}`, balance }));
  const t = planSettlements(entries);
  assert.ok(t.length <= entries.filter((e) => e.balance !== 0).length - 1);
  for (const [, v] of applyTransfers(entries, t)) assert.equal(v, 0);
});
