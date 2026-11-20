import Link from "next/link";
import { Clock, Link2Off, Users } from "lucide-react";
import { GroupBadge, Logo } from "@/components/app/bits";
import { buttonVariants } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { JoinButton } from "@/components/group/join-button";
import { getSession } from "@/lib/queries";
import { formatDateTime } from "@/lib/dates";
import type { InvitationPreview } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata = { title: "グループへの招待", robots: { index: false } };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { supabase, user } = await getSession();
  const { data } = await supabase.rpc("get_invitation_preview", { p_token: token });
  const preview = ((data as InvitationPreview[] | null)?.[0] ?? { status: "invalid" }) as InvitationPreview;
  const next = `/invite/${token}`;

  const unusable = preview.status === "invalid" || preview.status === "revoked" || preview.status === "expired" || preview.status === "exhausted";

  return (
    <div className="flex min-h-dvh flex-col items-center bg-[radial-gradient(70%_50%_at_50%_0%,#e3f3ea_0%,#f3f6f4_70%)] px-4 pb-16">
      <header className="flex h-16 items-center">
        <Link href="/">
          <Logo />
        </Link>
      </header>
      <div className="mt-4 w-full max-w-[400px] rounded-3xl border border-line bg-white p-6 text-center shadow-[0_20px_50px_-30px_rgb(16_40_30/0.35)] sm:mt-10 sm:p-8">
        {unusable ? (
          <>
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-minus-soft text-minus">
              <Link2Off className="size-7" />
            </span>
            <h1 className="mt-4 text-xl font-extrabold text-ink">この招待リンクは使えません</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              {preview.status === "invalid"
                ? "リンクが正しくありません。URL が途中で切れていないか確認してください。"
                : "有効期限が切れているか、無効化されています。グループのメンバーに新しいリンクを発行してもらってください。"}
            </p>
            <Link href={user ? "/dashboard" : "/"} className={cn(buttonVariants({ variant: "outline" }), "mt-6 w-full")}>
              {user ? "ホームへ" : "トップへ"}
            </Link>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold text-muted">
              {preview.inviter_name ? `${preview.inviter_name}さんからの招待` : "グループへの招待"}
            </p>
            <div className="mt-4 flex justify-center">
              <GroupBadge icon={preview.group_icon ?? "users"} color={preview.group_color ?? "green"} size={64} />
            </div>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink">{preview.group_name}</h1>
            <p className="mt-1.5 inline-flex items-center gap-1 text-[13px] text-muted">
              <Users className="size-4" /> {preview.member_count}人が参加中
            </p>

            <div className="mt-6 space-y-3 text-left">
              {preview.status === "already_member" && <Alert tone="success">すでにこのグループのメンバーです。</Alert>}
              {preview.status === "pending_request" && (
                <Alert tone="info">参加を申請済みです。管理者の承認をお待ちください。</Alert>
              )}
              {preview.status === "valid" && preview.requires_approval && (
                <Alert tone="info">このグループは承認制です。参加申請を送り、管理者が承認すると参加できます。</Alert>
              )}
            </div>

            <div className="mt-6">
              {preview.status === "already_member" ? (
                <Link href={`/groups/${preview.group_id}`} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
                  グループを開く
                </Link>
              ) : preview.status === "pending_request" ? (
                <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}>
                  ホームへ
                </Link>
              ) : user ? (
                <JoinButton token={token} requiresApproval={!!preview.requires_approval} />
              ) : (
                <div className="space-y-2.5">
                  <Link href={`/signup?next=${encodeURIComponent(next)}`} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
                    アカウントを作成して参加
                  </Link>
                  <Link href={`/login?next=${encodeURIComponent(next)}`} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}>
                    ログインして参加
                  </Link>
                </div>
              )}
            </div>
            {preview.expires_at && preview.status === "valid" && (
              <p className="mt-4 inline-flex items-center gap-1 text-[11px] text-muted">
                <Clock className="size-3.5" /> {formatDateTime(preview.expires_at)} まで有効
              </p>
            )}
          </>
        )}
      </div>
      <p className="mt-6 max-w-[400px] text-center text-[11px] leading-relaxed text-muted">
        参加すると、このグループの支出・精算の情報をメンバー同士で共有します。メールアドレスは他のメンバーに公開されません。
      </p>
    </div>
  );
}
