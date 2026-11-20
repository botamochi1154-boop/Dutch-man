/**
 * 金額ユーティリティ。金額は常に「円の整数」で扱い、浮動小数点の演算はしない。
 */

export const MAX_AMOUNT = 100_000_000;

const yenFormatter = new Intl.NumberFormat("ja-JP");

/** 12000 → "¥12,000"。sign=true で "+¥12,000" / "−¥12,000" */
export function formatYen(value: number, opts: { sign?: boolean } = {}): string {
  const abs = yenFormatter.format(Math.abs(value));
  if (opts.sign) {
    if (value > 0) return `+¥${abs}`;
    if (value < 0) return `−¥${abs}`;
    return `¥${abs}`;
  }
  return value < 0 ? `−¥${abs}` : `¥${abs}`;
}

/** 全角数字・カンマ・円記号を許容して整数の円に変換。不正なら null */
export function parseYen(input: string): number | null {
  const normalized = toHalfWidth(input).replace(/[,\s¥￥円]/g, "");
  if (!/^\d{1,9}$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isSafeInteger(n) ? n : null;
}

/** "33.33" → 3333（bp: 1% = 100）。小数第2位まで。不正なら null */
export function parsePercentToBp(input: string): number | null {
  const s = toHalfWidth(input).replace(/[\s%％]/g, "");
  const m = /^(\d{1,3})(?:\.(\d{0,2}))?$/.exec(s);
  if (!m) return null;
  const bp = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || "0");
  return bp <= 10000 ? bp : null;
}

/** 3333 → "33.33" */
export function formatBp(bp: number): string {
  const whole = Math.floor(bp / 100);
  const frac = bp % 100;
  return frac === 0 ? `${whole}` : `${whole}.${String(frac).padStart(2, "0").replace(/0$/, "")}`;
}

export function toHalfWidth(s: string): string {
  return s.replace(/[０-９．，]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}
