"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Bell, ChartPie, House, Plus, Settings, Users } from "lucide-react";
import { Logo } from "@/components/app/bits";
import { Avatar } from "@/components/ui/misc";
import { NotificationBell } from "@/components/app/notification-bell";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "ホーム", icon: House },
  { href: "/groups", label: "グループ", icon: Users },
  { href: "/analytics", label: "分析", icon: ChartPie },
  { href: "/notifications", label: "通知", icon: Bell },
  { href: "/settings", label: "設定", icon: Settings },
];

function isActive(path: string, href: string) {
  return path === href || path.startsWith(`${href}/`);
}

export function AppShell({
  children,
  profile,
  unread,
}: {
  children: ReactNode;
  profile: { id: string; display_name: string; avatar_color: string };
  unread: number;
}) {
  const path = usePathname();
  const groupMatch = /^\/groups\/([0-9a-f-]{36})/.exec(path);
  const addHref = groupMatch ? `/groups/${groupMatch[1]}/expenses/new` : "/expenses/new";

  return (
    <div className="min-h-dvh">
      {/* PC：サイドバー */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-white lg:flex">
        <div className="flex h-16 items-center px-6">
          <Link href="/dashboard" aria-label="ホーム">
            <Logo />
          </Link>
        </div>
        <div className="px-4 pb-2">
          <Link
            href={addHref}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            <Plus className="size-[18px]" />
            支出を追加
          </Link>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-2" aria-label="メインメニュー">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(path, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors",
                  active ? "bg-brand-50 font-bold text-brand-700" : "text-ink-soft hover:bg-canvas hover:text-ink",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.3 : 2} />
                {label}
                {href === "/notifications" && unread > 0 && (
                  <span className="ml-auto rounded-full bg-minus px-1.5 text-[11px] font-bold leading-5 text-white num">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <Link href="/settings" className="m-3 flex items-center gap-3 rounded-xl p-2.5 hover:bg-canvas">
          <Avatar name={profile.display_name} color={profile.avatar_color} size={36} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{profile.display_name}</p>
            <p className="text-xs text-muted">プロフィール・設定</p>
          </div>
        </Link>
      </aside>

      {/* スマホ：ヘッダー */}
      <header className="sticky top-0 z-30 border-b border-line/70 bg-white/85 backdrop-blur-md lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/dashboard" aria-label="ホーム">
            <Logo />
          </Link>
          <NotificationBell userId={profile.id} initialUnread={unread} />
        </div>
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-5xl px-4 pb-32 pt-5 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">{children}</div>
      </main>

      {/* スマホ：下部タブ */}
      <nav
        aria-label="メインメニュー"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-safe backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
          {[NAV[0], NAV[1]].map((item) => (
            <TabLink key={item.href} {...item} active={isActive(path, item.href)} />
          ))}
          <div className="flex justify-center">
            <Link
              href={addHref}
              aria-label="支出を追加"
              className="-mt-6 flex size-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-[0_8px_20px_-6px_rgb(31_122_85/0.6)] transition active:scale-95"
            >
              <Plus className="size-7" strokeWidth={2.4} />
            </Link>
          </div>
          {[NAV[2], NAV[4]].map((item) => (
            <TabLink key={item.href} {...item} active={isActive(path, item.href)} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function TabLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof House;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-full flex-col items-center justify-center gap-1 text-[10.5px] font-semibold",
        active ? "text-brand-700" : "text-muted",
      )}
    >
      <Icon className="size-[22px]" strokeWidth={active ? 2.3 : 1.9} />
      {label}
    </Link>
  );
}
