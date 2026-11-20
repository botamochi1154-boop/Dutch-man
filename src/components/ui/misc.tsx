import type { HTMLAttributes, ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn, initial } from "@/lib/utils";

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "brand" | "warn" | "danger" | "info" }) {
  const tones = {
    neutral: "bg-canvas text-ink-soft",
    brand: "bg-brand-50 text-brand-700",
    warn: "bg-warn-soft text-warn",
    danger: "bg-minus-soft text-minus",
    info: "bg-[#EAF1FB] text-[#2563AB]",
  };
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", tones[tone], className)}
      {...props}
    />
  );
}

export function Avatar({
  name,
  color,
  size = 36,
  className,
  ring,
}: {
  name: string;
  color: string;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white select-none",
        ring && "ring-2 ring-white",
        className,
      )}
      style={{ width: size, height: size, backgroundColor: color, fontSize: Math.round(size * 0.42) }}
    >
      {initial(name)}
    </span>
  );
}

export function AvatarStack({ people, max = 5, size = 28 }: { people: { name: string; color: string }[]; max?: number; size?: number }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((p, i) => (
        <Avatar key={i} name={p.name} color={p.color} size={size} ring />
      ))}
      {rest > 0 && (
        <span
          className="inline-flex items-center justify-center rounded-full bg-canvas text-[11px] font-bold text-ink-soft ring-2 ring-white"
          style={{ width: size, height: size }}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-[#e9eeeb]", className)} />;
}

export function Alert({
  tone = "info",
  title,
  children,
  className,
  action,
}: {
  tone?: "info" | "success" | "warn" | "danger";
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  const map = {
    info: { cls: "bg-[#EEF4FB] text-[#244E7E] border-[#D6E3F3]", Icon: Info },
    success: { cls: "bg-brand-50 text-brand-800 border-brand-100", Icon: CircleCheck },
    warn: { cls: "bg-warn-soft text-[#7A4F0E] border-[#F3E2BD]", Icon: TriangleAlert },
    danger: { cls: "bg-minus-soft text-[#8C2A23] border-[#F5D3CF]", Icon: CircleAlert },
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl border px-4 py-3 text-[13px]", map.cls, className)}>
      <map.Icon className="mt-0.5 size-[18px] shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 leading-relaxed">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5")}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-10 text-center", className)}>
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 [&_svg]:size-6">{icon}</div>
      <p className="text-[15px] font-bold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px bg-line", className)} />;
}
