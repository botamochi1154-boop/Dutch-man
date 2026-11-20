import Link from "next/link";
import { ChevronRight, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/app/bits";
import { ProfileForm } from "@/components/app/profile-form";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { signOut } from "@/lib/actions/auth";
import { getMyProfile } from "@/lib/queries";

export const metadata = { title: "設定" };

export default async function SettingsPage() {
  const profile = await getMyProfile();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="設定" />
      <Card>
        <CardHeader title="プロフィール" description="グループのメンバーに表示されます" />
        <div className="px-5 pb-5 pt-4">
          <ProfileForm name={profile.display_name} color={profile.avatar_color} />
        </div>
      </Card>

      <Card>
        <CardHeader title="アカウント" />
        <div className="mt-2 divide-y divide-line">
          <div className="px-5 py-3.5">
            <p className="text-xs text-muted">メールアドレス（他のメンバーには公開されません）</p>
            <p className="mt-0.5 text-sm font-semibold text-ink">{profile.email}</p>
          </div>
          <Link href="/reset-password" className="flex items-center gap-3 px-5 py-3.5 hover:bg-canvas/70">
            <KeyRound className="size-5 text-muted" />
            <span className="flex-1 text-sm font-semibold text-ink">パスワードを変更</span>
            <ChevronRight className="size-4 text-line" />
          </Link>
          <form action={signOut} className="px-5 py-3.5">
            <Button type="submit" variant="danger-ghost" size="sm" className="-ml-3">
              <LogOut /> ログアウト
            </Button>
          </form>
        </div>
      </Card>

      <p className="flex items-start gap-1.5 px-1 text-[11px] leading-relaxed text-muted">
        <ShieldCheck className="mt-px size-3.5 shrink-0" />
        データはグループ単位でデータベースの行レベルアクセス制御（RLS）により保護され、参加していないグループの情報は閲覧できません。
      </p>
    </div>
  );
}
