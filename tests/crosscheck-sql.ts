/**
 * TS 実装（src/lib/split.ts）と DB 実装（private.compute_split）がランダム入力で完全一致するかを検証。
 *   使い方: PGPORT=54329 npx tsx tests/crosscheck-sql.ts   （run.sh --keep で起動したDBに対して）
 */
import { execFileSync } from "node:child_process";
import { computeSplitOrdered, type SplitMethod } from "../src/lib/split";

const CASES = Number(process.env.CASES ?? 2000);
let seed = 2026;
const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2147483648), seed % n);
const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;

type Case = { amount: number; method: SplitMethod; ids: string[]; values: number[] | null };
const cases: Case[] = [];
for (let t = 0; t < CASES; t++) {
  const n = 1 + rnd(10);
  const ids = Array.from({ length: n }, (_, i) => uuid(rnd(1000) * 100 + i));
  const amount = 1 + rnd(t % 3 === 0 ? 1000 : 100_000_000);
  const method: SplitMethod = (["equal", "percent", "exact"] as const)[rnd(3)];
  let values: number[] | null = null;
  if (method === "percent") {
    const cuts = Array.from({ length: n - 1 }, () => rnd(10001)).sort((a, b) => a - b);
    const pts = [0, ...cuts, 10000];
    values = pts.slice(1).map((p, i) => p - pts[i]);
  } else if (method === "exact") {
    const cuts = Array.from({ length: n - 1 }, () => rnd(amount + 1)).sort((a, b) => a - b);
    const pts = [0, ...cuts, amount];
    values = pts.slice(1).map((p, i) => p - pts[i]);
  }
  cases.push({ amount, method, ids, values });
}

const sql =
  "select json_agg(r order by ord) from (" +
  cases
    .map(
      (c, i) =>
        `select ${i} as ord, (select json_agg(s.share_amount order by k) from private.compute_split(${c.amount}, '${c.method}', ` +
        `array[${c.ids.map((x) => `'${x}'`).join(",")}]::uuid[], ${c.values ? `array[${c.values.join(",")}]::bigint[]` : "null"}) ` +
        `with ordinality as s(user_id, share_amount, input_value, k)) as r`,
    )
    .join(" union all ") +
  ") q";

const out = execFileSync("psql", ["-h", "/tmp", "-p", process.env.PGPORT ?? "54329", "-U", "postgres", "-d", "postgres", "-At", "-X"], {
  input: sql,
  maxBuffer: 64 * 1024 * 1024,
}).toString();
const dbResults: number[][] = JSON.parse(out);

let mismatches = 0;
cases.forEach((c, i) => {
  const ts = computeSplitOrdered(c.amount, c.method, c.ids, c.values);
  if (!ts.ok) throw new Error(`TS error on case ${i}: ${ts.error}`);
  const a = ts.shares.map((s) => s.share).join(",");
  const b = dbResults[i].join(",");
  if (a !== b) {
    mismatches++;
    if (mismatches < 5) console.error("MISMATCH", JSON.stringify(c), a, b);
  }
});
if (mismatches) {
  console.error(`❌ ${mismatches}/${cases.length} 件で不一致`);
  process.exit(1);
}
console.log(`✔ TS と SQL の割り勘計算が ${cases.length} 件すべてで一致`);
