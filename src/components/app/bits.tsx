import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { CATEGORIES, GROUP_COLORS, GROUP_ICONS } from "@/lib/constants";
import { formatYen } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Category, GroupColor, GroupIconKey } from "@/lib/types";

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="9" fill="#1F7A55" />
        <path d="M16 7a9 9 0 1 0 9 9h-9V7Z" fill="#fff" />
        <path d="M18.5 4.8a9 9 0 0 1 8.7 8.7h-8.7V4.8Z" fill="#9FD9BC" />
      </svg>
      {!compact && <span className="text-[17px] font-extrabold tracking-tight text-ink">WariNote</span>}
    </span>
  );
}

export function GroupBadge({
  icon,
  color,
  size = 44,
  className,
}: {
  icon: GroupIconKey;
  color: GroupColor;
  size?: number;
  className?: string;
}) {
  const Icon = GROUP_ICONS[icon]?.icon ?? GROUP_ICONS.users.icon;
  const c = GROUP_COLORS[color] ?? GROUP_COLORS.green;
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-2xl", className)}
      style={{ width: size, height: size, backgroundColor: c.bg, color: c.fg }}
      aria-hidden
    >
      <Icon style={{ width: size * 0.48, height: size * 0.48 }} strokeWidth={2} />
    </span>
  );
}

export function CategoryBadge({ category, size = 40 }: { category: Category; size?: number }) {
  const c = CATEGORIES[category] ?? CATEGORIES.other;
  const Icon = c.icon;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-xl"
      style={{ width: size, height: size, backgroundColor: `${c.color}17`, color: c.color }}
      aria-hidden
    >
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2} />
    </span>
  );
}

/** 金額表示。tone=auto は正なら緑・負なら赤 */
export function Amount({
  value,
  sign,
  tone = "neutral",
  className,
}: {
  value: number;
  sign?: boolean;
  tone?: "neutral" | "auto" | "plus" | "minus" | "muted";
  className?: string;
}) {
  const t = tone === "auto" ? (value > 0 ? "plus" : value < 0 ? "minus" : "muted") : tone;
  const color = { neutral: "text-ink", plus: "text-plus", minus: "text-minus", muted: "text-muted" }[t];
  return <span className={cn("num font-bold", color, className)}>{formatYen(value, { sign })}</span>;
}

export function PageHeader({
  title,
  description,
  back,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  back?: { href: string; label?: string };
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        {back && (
          <Link
            href={back.href}
            className="mb-1.5 -ml-1 inline-flex items-center gap-0.5 rounded-lg px-1 py-0.5 text-[13px] font-medium text-muted hover:text-ink"
          >
            <ChevronLeft className="size-4" />
            {back.label ?? "戻る"}
          </Link>
        )}
        <h1 className="truncate text-[22px] font-extrabold tracking-tight text-ink lg:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 mt-7 flex items-center justify-between px-1 first:mt-0">
      <h2 className="text-[13px] font-bold tracking-wide text-ink-soft">{children}</h2>
      {action}
    </div>
  );
}
