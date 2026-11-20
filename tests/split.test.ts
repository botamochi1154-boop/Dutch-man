import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSplit, computeSplitOrdered, evenPercents } from "../src/lib/split";
import { parseYen, parsePercentToBp, formatYen, formatBp } from "../src/lib/money";

const A = "a", B = "b", C = "c", D = "d";
const shareOf = (r: ReturnType<typeof computeSplit>, id: string) => {
  assert.ok(r.ok);
  return r.shares.find((s) => s.userId === id)!.share;
};
const sum = (r: ReturnType<typeof computeSplit>) => {
  assert.ok(r.ok);
  return r.shares.reduce((s, x) => s + x.share, 0);
};

test("仕様例：12,000円を A・B・C で均等割り → 各 4,000円", () => {
  const r = computeSplit({ amount: 12000, method: "equal", participants: [A, B, C], payerId: A });
  assert.deepEqual([shareOf(r, A), shareOf(r, B), shareOf(r, C)], [4000, 4000, 4000]);
});

test("端数：10,000円を3人 → 支払者が 3,334円、他は 3,333円", () => {
  const r = computeSplit({ amount: 10000, method: "equal", participants: [A, B, C], payerId: B });
  assert.equal(shareOf(r, B), 3334);
  assert.equal(shareOf(r, A), 3333);
  assert.equal(shareOf(r, C), 3333);
  assert.equal(sum(r), 10000);
});

test("端数：支払者が対象外なら参加順に1円ずつ", () => {
  const r = computeSplit({ amount: 101, method: "equal", participants: [B, C, D], payerId: A });
  assert.deepEqual([shareOf(r, B), shareOf(r, C), shareOf(r, D)], [34, 34, 33]);
});

test("特定メンバーだけで割り勘（2人）", () => {
  const r = computeSplit({ amount: 3001, method: "equal", participants: [B, D], payerId: A });
  assert.equal(sum(r), 3001);
  assert.ok(r.ok && r.shares.length === 2);
});

test("金額指定：合計一致なら指定どおり、不一致ならエラー", () => {
  const ok = computeSplit({ amount: 5000, method: "exact", participants: [A, B], values: [1200, 3800], payerId: A });
  assert.equal(shareOf(ok, B), 3800);
  const ng = computeSplit({ amount: 5000, method: "exact", participants: [A, B], values: [1000, 3000], payerId: A });
  assert.deepEqual(ng, { ok: false, error: "SPLIT_SUM_MISMATCH" });
});

test("割合：最大剰余法で端数を配分し合計一致", () => {
  const r = computeSplit({ amount: 1001, method: "percent", participants: [A, B, C], values: [3333, 3333, 3334], payerId: A });
  assert.deepEqual([shareOf(r, A), shareOf(r, B), shareOf(r, C)], [334, 333, 334]);
  const ng = computeSplit({ amount: 1000, method: "percent", participants: [A, B], values: [5000, 4000], payerId: A });
  assert.deepEqual(ng, { ok: false, error: "PERCENT_SUM_MISMATCH" });
});

test("不正入力", () => {
  assert.deepEqual(computeSplit({ amount: 0, method: "equal", participants: [A], payerId: A }), { ok: false, error: "INVALID_AMOUNT" });
  assert.deepEqual(computeSplit({ amount: 1.5, method: "equal", participants: [A], payerId: A }), { ok: false, error: "INVALID_AMOUNT" });
  assert.deepEqual(computeSplit({ amount: 100, method: "equal", participants: [], payerId: A }), { ok: false, error: "NO_PARTICIPANTS" });
  assert.deepEqual(computeSplit({ amount: 100, method: "equal", participants: [A, A], payerId: A }), { ok: false, error: "DUPLICATE_PARTICIPANT" });
});

test("ランダム10,000件：どの方式でも合計は必ず支出額に一致し、負担は非負整数", () => {
  let seed = 42;
  const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2147483648), seed % n);
  for (let t = 0; t < 10000; t++) {
    const n = 1 + rnd(12);
    const ids = Array.from({ length: n }, (_, i) => `u${i}`);
    const amount = 1 + rnd(100_000_000);
    const kind = rnd(2);
    const r =
      kind === 0
        ? computeSplit({ amount, method: "equal", participants: ids, payerId: ids[rnd(n)] })
        : computeSplit({ amount, method: "percent", participants: ids, values: randomBp(n, rnd), payerId: ids[rnd(n)] });
    assert.ok(r.ok);
    assert.equal(r.shares.reduce((s, x) => s + x.share, 0), amount);
    for (const s of r.shares) assert.ok(Number.isInteger(s.share) && s.share >= 0);
    if (kind === 0) {
      const v = r.shares.map((s) => s.share);
      assert.ok(Math.max(...v) - Math.min(...v) <= 1, "均等割りの差は最大1円");
    }
  }
});

function randomBp(n: number, rnd: (n: number) => number): number[] {
  const cuts = Array.from({ length: n - 1 }, () => rnd(10001)).sort((a, b) => a - b);
  const pts = [0, ...cuts, 10000];
  return pts.slice(1).map((p, i) => p - pts[i]);
}

test("evenPercents は合計 100%", () => {
  for (let n = 1; n <= 30; n++) assert.equal(evenPercents(n).reduce((a, b) => a + b, 0), 10000);
});

test("computeSplitOrdered は並び順をそのまま優先順にする", () => {
  const r = computeSplitOrdered(5, "equal", [C, A], null);
  assert.ok(r.ok);
  assert.deepEqual(r.shares.map((s) => s.share), [3, 2]);
});

test("金額の入力・表示", () => {
  assert.equal(parseYen("12,000"), 12000);
  assert.equal(parseYen("１２０００円"), 12000);
  assert.equal(parseYen("¥800"), 800);
  assert.equal(parseYen("12.5"), null);
  assert.equal(parseYen("-100"), null);
  assert.equal(parsePercentToBp("33.33"), 3333);
  assert.equal(parsePercentToBp("50"), 5000);
  assert.equal(parsePercentToBp("12.5"), 1250);
  assert.equal(parsePercentToBp("100.01"), null);
  assert.equal(formatYen(12000), "¥12,000");
  assert.equal(formatYen(-3000, { sign: true }), "−¥3,000");
  assert.equal(formatYen(3000, { sign: true }), "+¥3,000");
  assert.equal(formatBp(3333), "33.33");
  assert.equal(formatBp(1250), "12.5");
  assert.equal(formatBp(5000), "50");
});
