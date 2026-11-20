import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/auth-forms";

export const metadata = { title: "新しいパスワード" };

export default function ResetPasswordPage() {
  return (
    <AuthCard title="新しいパスワード" description="新しいパスワードを設定してください。">
      <ResetPasswordForm />
    </AuthCard>
  );
}
