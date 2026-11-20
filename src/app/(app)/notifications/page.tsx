import Link from "next/link";
import { BellOff, BellRing, CalendarClock, CircleCheck, HandCoins, Receipt, UserPlus, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/app/bits";
import { MarkAllRead } from "@/components/app/mark-all-read";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { formatRelative } from "@/lib/dates";
import { getNotifications, requireUser } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const metadata = { title: "通知" };

const ICONS: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  expense: { icon: Receipt, color: "#2563AB", bg: "#E5EEF9" },
  settlement: { icon: HandCoins, color: "#1F7A55", bg: "#E4F2EA" },
  reminder: { icon: BellRing, color: "#A86A12", bg: "#FDF5E4" },
  member: { icon: UserPlus, color: "#4B4FB0", bg: "#ECECFA" },
  done: { icon: CircleCheck, color: "#1F7A55", bg: "#E4F2EA" },
  due: { icon: CalendarClock, color: "#C8433A", bg: "#FCEFED" },
};

function kind(type: string) {
  if (type.startsWith("expense")) return ICONS.expense;
  if (type === "all_settled") return ICONS.done;
  if (type.startsWith("settlement")) return ICONS.settlement;
  if (type === "payment_reminder") return ICONS.reminder;
  if (type.startsWith("due")) return ICONS.due;
  return ICONS.member;
}

export default async function NotificationsPage() {
  const { supabase } = await requireUser();
  const items = await getNotifications(supabase, 100);
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="通知" description={unread ? `未読 ${unread}件` : "すべて既読です"} action={unread > 0 ? <MarkAllRead /> : undefined} />
      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <EmptyState icon={<BellOff />} title="通知はまだありません" description="支出の追加や精算の申告があると、ここに届きます。" />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((n) => {
              const k = kind(n.type);
              return (
                <li key={n.id}>
                  <Link
                    href={`/notifications/${n.id}/open`}
                    prefetch={false}
                    className={cn("flex gap-3 px-4 py-3.5 transition-colors hover:bg-canvas/70 sm:px-5", !n.read_at && "bg-brand-50/40")}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: k.bg, color: k.color }}>
                      <k.icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn("text-sm text-ink", !n.read_at ? "font-bold" : "font-semibold")}>{n.title}</p>
                        <span className="shrink-0 text-[11px] text-muted">{formatRelative(n.created_at)}</span>
                      </div>
                      {n.body && <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">{n.body}</p>}
                    </div>
                    {!n.read_at && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-minus" aria-label="未読" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <p className="mt-3 px-1 text-[11px] leading-relaxed text-muted">
        通知はアプリ内に届きます（メール・プッシュ通知には今後対応予定です）。
      </p>
    </div>
  );
}
