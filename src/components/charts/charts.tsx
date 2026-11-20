"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SERIES } from "@/lib/constants";
import { formatYen } from "@/lib/money";

const AXIS = { fontSize: 11, fill: "#77837d" };
const GRID = "#e9eeeb";
const tooltipStyle = {
  contentStyle: {
    borderRadius: 12,
    border: "1px solid #e4e9e6",
    boxShadow: "0 8px 24px -12px rgb(16 40 30 / 0.25)",
    fontSize: 12,
    padding: "8px 12px",
  },
  labelStyle: { color: "#17201c", fontWeight: 700, marginBottom: 4 },
  itemStyle: { color: "#46524c", padding: 0 },
  cursor: { fill: "rgb(31 122 85 / 0.06)" },
};
const legendStyle = { fontSize: 12, color: "#46524c", paddingTop: 8 };

/** 12,000 → "1.2万" のような軸ラベル */
function yenTick(v: number): string {
  if (v >= 10000) {
    const man = v / 10000;
    return `${Number.isInteger(man) ? man : man.toFixed(1)}万`;
  }
  return v.toLocaleString("ja-JP");
}

export function MonthlyChart({ data }: { data: { label: string; total: number; mine: number }[] }) {
  return (
    <div className="h-64 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => yenTick(Number(v))} width={48} />
          <Tooltip {...tooltipStyle} formatter={(v) => formatYen(Number(v))} />
          <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />
          <Bar dataKey="total" name="グループ合計" fill={SERIES.groupTotal} radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="mine" name="あなたの負担" fill={SERIES.mine} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryDonut({ data }: { data: { key: string; label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const rows = data.filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  if (!total) return <p className="py-12 text-center text-[13px] text-muted">この期間の支出はありません</p>;
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="100%" stroke="#fff" strokeWidth={2} startAngle={90} endAngle={-270}>
              {rows.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} formatter={(v) => formatYen(Number(v))} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] text-muted">合計</span>
          <span className="num text-base font-bold text-ink">{formatYen(total)}</span>
        </div>
      </div>
      <ul className="w-full space-y-2">
        {rows.map((d) => (
          <li key={d.key} className="flex items-center gap-2.5 text-[13px]">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="flex-1 text-ink-soft">{d.label}</span>
            <span className="num w-10 text-right text-xs text-muted">{Math.round((d.value / total) * 100)}%</span>
            <span className="num w-24 text-right font-semibold text-ink">{formatYen(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GroupBars({ data }: { data: { name: string; value: number }[] }) {
  const h = Math.max(120, data.length * 44 + 20);
  return (
    <div className="w-full" style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => yenTick(Number(v))} />
          <YAxis type="category" dataKey="name" tick={{ ...AXIS, fill: "#46524c" }} axisLine={false} tickLine={false} width={96} />
          <Tooltip {...tooltipStyle} formatter={(v) => formatYen(Number(v))} />
          <Bar dataKey="value" name="総支出" fill={SERIES.groupTotal} radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MemberBars({ data }: { data: { name: string; paid: number; share: number }[] }) {
  const h = Math.max(140, data.length * 56 + 40);
  return (
    <div className="w-full" style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => yenTick(Number(v))} />
          <YAxis type="category" dataKey="name" tick={{ ...AXIS, fill: "#46524c" }} axisLine={false} tickLine={false} width={80} />
          <Tooltip {...tooltipStyle} formatter={(v) => formatYen(Number(v))} />
          <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />
          <Bar dataKey="paid" name="立替（支払った額）" fill={SERIES.paid} radius={[0, 4, 4, 0]} maxBarSize={16} />
          <Bar dataKey="share" name="負担（自分の分）" fill={SERIES.share} radius={[0, 4, 4, 0]} maxBarSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
