"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, UserPlus } from "lucide-react";
import { GroupBadge } from "@/components/app/bits";
import { RealtimeSync } from "@/components/app/realtime";
import { buttonVariants } from "@/components/ui/button";
import { AvatarStack } from "@/components/ui/misc";
import type { GroupColor, GroupIconKey } from "@/lib/types";
import { cn } from "@/lib/utils";

/** グループ配下の共通ヘッダー＋タブ。支出の入力・詳細画面ではコンパクト表示 */
export function GroupChrome({
  group,
  memberAvatars,
}: {
  group: { id: string; name: string; icon: GroupIconKey; color: GroupColor };
  memberAvatars: { name: string; color: string }[];
}) {
  const path = usePathname();
  const base = `/groups/${group.id}`;
  const tabs = [
    { href: base, label: "概要" },
    { href: `${base}/expenses`, label: "支出" },
    { href: `${base}/settle`, label: "精算" },
    { href: `${base}/members`, label: "メンバー" },
  ];
  const compact = /\/expenses\/(new|[0-9a-f-]{36})/.test(path);

  if (compact) {
    return (
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href={`${base}/expenses`} className="inline-flex min-w-0 items-center gap-1 text-[13px] font-semibold text-muted hover:text-ink">
          <ChevronLeft className="size-4 shrink-0" />
          <GroupBadge icon={group.icon} color={group.color} size={22} className="rounded-md" />
          <span className="truncate">{group.name}</span>
        </Link>
        <RealtimeSync groupIds={[group.id]} />
      </div>
    );
  }

  return (
    <div className="mb-5">
      <div className="flex items-center gap-3.5">
        <GroupBadge icon={group.icon} color={group.color} size={52} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-extrabold tracking-tight text-ink lg:text-2xl">{group.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <AvatarStack people={memberAvatars} size={22} max={6} />
            <span className="text-xs text-muted">{memberAvatars.length}人</span>
            <span className="hidden sm:inline">
              <RealtimeSync groupIds={[group.id]} showStatus />
            </span>
          </div>
        </div>
        <Link href={`${base}/members`} className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "hidden sm:inline-flex")}>
          <UserPlus /> 招待
        </Link>
      </div>
      <nav className="scrollbar-none -mx-4 mt-5 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0" aria-label="グループメニュー">
        {tabs.map((t) => {
          const active = t.href === base ? path === base : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative shrink-0 px-3.5 pb-3 pt-1 text-sm font-semibold transition-colors",
                active ? "text-brand-700" : "text-muted hover:text-ink",
              )}
            >
              {t.label}
              {active && <span className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-brand-600" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
