import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/auth-forms";
import { safeNext } from "@/lib/utils";

export const metadata = { title: "ログイン" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const nextPath = safeNext(next);
  const fromInvite = nextPath.startsWith("/invite/");
  return (
    <AuthCard
      title="ログイン"
      description={fromInvite ? "ログインすると、招待されたグループに参加できます。" : "おかえりなさい。"}
      footer={
        <>
          はじめての方は{" "}
          <Link href={`/signup?next=${encodeURIComponent(nextPath)}`} className="font-bold text-brand-700 hover:underline">
            新規登録
          </Link>
        </>
      }
    >
      <LoginForm
        next={nextPath}
        notice={error === "link" ? "リンクの有効期限が切れているか、すでに使用されています。もう一度お試しください。" : undefined}
      />
    </AuthCard>
  );
}
