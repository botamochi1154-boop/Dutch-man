/** 日付はすべて日本時間で扱う */
const TZ = "Asia/Tokyo";
const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

function parts(d: Date, tz = TZ) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
    hh: get("hour"),
    mm: get("minute"),
    wd,
  };
}

/** 今日（JST）を YYYY-MM-DD で */
export function todayJST(): string {
  const p = parts(new Date());
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** "2026-11-20" → Date(UTC 00:00) */
function dateOnly(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** "2026-11-20" → "11/20(金)" */
export function formatDate(s: string): string {
  const d = dateOnly(s);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WEEK[d.getUTCDay()]})`;
}

/** "2026-11-20" → "2026年11月20日(金)" */
export function formatDateLong(s: string): string {
  const d = dateOnly(s);
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日(${WEEK[d.getUTCDay()]})`;
}

/** ISO 日時 → "11/20 23:10" */
export function formatDateTime(iso: string): string {
  const p = parts(new Date(iso));
  return `${p.m}/${p.d} ${p.hh}:${p.mm}`;
}

/** ISO 日時 → "たった今" / "5分前" / "3時間前" / "昨日" / "11/18" */
export function formatRelative(iso: string, now = new Date()): string {
  const diff = (now.getTime() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "たった今";
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  if (diff < 172800) return "昨日";
  const p = parts(new Date(iso));
  const n = parts(now);
  return p.y === n.y ? `${p.m}/${p.d}` : `${p.y}/${p.m}/${p.d}`;
}

/** "2026-11-20" → "2026-11" */
export function monthKey(s: string): string {
  return s.slice(0, 7);
}

/** "2026-11" → "11月" または "2026年11月" */
export function formatMonth(key: string, withYear = false): string {
  const [y, m] = key.split("-").map(Number);
  return withYear ? `${y}年${m}月` : `${m}月`;
}

/** 今日から過去 n か月分の月キー（古い順） */
export function lastMonths(n: number): string[] {
  const [y, m] = todayJST().split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

/** 期限までの日数（今日=0、過ぎていれば負） */
export function daysUntil(dateStr: string): number {
  return Math.round((dateOnly(dateStr).getTime() - dateOnly(todayJST()).getTime()) / 86400000);
}

export function dueLabel(dateStr: string): { text: string; tone: "danger" | "warn" | "muted" } {
  const n = daysUntil(dateStr);
  if (n < 0) return { text: `期限を${-n}日過ぎています`, tone: "danger" };
  if (n === 0) return { text: "今日が精算期限", tone: "danger" };
  if (n <= 3) return { text: `精算期限まであと${n}日`, tone: "warn" };
  return { text: `精算期限 ${formatDate(dateStr)}`, tone: "muted" };
}
