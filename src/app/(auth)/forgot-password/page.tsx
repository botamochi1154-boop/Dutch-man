import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export const metadata = { title: "パスワードの再設定" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="パスワードの再設定"
      description="登録したメールアドレスに、再設定用のリンクをお送りします。"
      footer={
        <Link href="/login" className="font-bold text-brand-700 hover:underline">
          ログインに戻る
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
