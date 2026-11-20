import type { ReactNode } from "react";
import { AppShell } from "@/components/app/app-shell";
import { getMyProfile, getUnreadCount, requireUser } from "@/lib/queries";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { supabase } = await requireUser();
  const [profile, unread] = await Promise.all([getMyProfile(), getUnreadCount(supabase)]);
  return (
    <AppShell profile={profile} unread={unread}>
      {children}
    </AppShell>
  );
}
