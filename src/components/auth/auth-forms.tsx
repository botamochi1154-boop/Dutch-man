"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { requestPasswordReset, signIn, signUp, updatePassword } from "@/lib/actions/auth";
import type { FormState } from "@/lib/types";

function PasswordInput({ name, autoComplete, id }: { name: string; autoComplete: string; id: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} name={name} type={show ? "text" : "password"} autoComplete={autoComplete} required minLength={8} className="pr-12" />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-canvas"
        aria-label={show ? "パスワードを隠す" : "パスワードを表示"}
      >
        {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
      </button>
    </div>
  );
}

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {notice && <Alert tone="danger">{notice}</Alert>}
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      <Field label="メールアドレス" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required placeholder="you@example.com" />
      </Field>
      <Field
        label={
          <span className="flex w-full items-center justify-between">
            パスワード
            <Link href="/forgot-password" className="text-xs font-medium text-brand-700 hover:underline">
              お忘れの方
            </Link>
          </span>
        }
        htmlFor="password"
      >
        <PasswordInput id="password" name="password" autoComplete="current-password" />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        ログイン
      </Button>
    </form>
  );
}

export function SignupForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signUp, null);
  if (state?.success) {
    return (
      <div className="py-2 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <MailCheck className="size-7" />
        </span>
        <p className="mt-4 font-bold text-ink">確認メールを送信しました</p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">{state.success}</p>
        <p className="mt-4 text-xs text-muted">メールが届かない場合は迷惑メールフォルダもご確認ください。</p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      <Field label="表示名" htmlFor="display_name" hint="グループのメンバーに表示されます（あとで変更できます）">
        <Input id="display_name" name="display_name" autoComplete="nickname" required maxLength={30} placeholder="例：たろう" />
      </Field>
      <Field label="メールアドレス" htmlFor="email" hint="他のメンバーには公開されません">
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required placeholder="you@example.com" />
      </Field>
      <Field label="パスワード" htmlFor="password" hint="8文字以上">
        <PasswordInput id="password" name="password" autoComplete="new-password" />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        アカウントを作成
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestPasswordReset, null);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}
      <Field label="登録したメールアドレス" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        再設定メールを送る
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(updatePassword, null);
  if (state?.success) {
    return (
      <div className="space-y-4">
        <Alert tone="success">{state.success}</Alert>
        <Link href="/dashboard" className="block">
          <Button size="lg" className="w-full">
            ホームへ
          </Button>
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      <Field label="新しいパスワード" htmlFor="password" hint="8文字以上">
        <PasswordInput id="password" name="password" autoComplete="new-password" />
      </Field>
      <Field label="新しいパスワード（確認）" htmlFor="confirm">
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        パスワードを変更
      </Button>
    </form>
  );
}
