import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/auth-forms";
import { safeNext } from "@/lib/utils";

export const metadata = { title: "新規登録" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const nextPath = safeNext(next);
  return (
    <AuthCard
      title="アカウントを作成"
      description={
        nextPath.startsWith("/invite/")
          ? "登録が完了すると、招待されたグループに参加できます。"
          : "メールアドレスで無料登録。グループを作って、招待リンクをメンバーに送りましょう。"
      }
      footer={
        <>
          すでにアカウントをお持ちの方は{" "}
          <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="font-bold text-brand-700 hover:underline">
            ログイン
          </Link>
        </>
      }
    >
      <SignupForm next={nextPath} />
    </AuthCard>
  );
}
