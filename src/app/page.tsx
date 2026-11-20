import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BellRing, ChartPie, HandCoins, Link2, RefreshCw, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/app/bits";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/queries";
import { readSupabaseConfig } from "@/lib/env";
import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: Link2, title: "URLを送るだけで参加", body: "LINE で招待リンクを送れば、それぞれ自分のスマホから参加できます。" },
  { icon: RefreshCw, title: "全員の画面にすぐ反映", body: "誰かが支出を登録すると、メンバー全員の画面がリアルタイムに更新されます。" },
  { icon: HandCoins, title: "送金回数が最少の精算", body: "誰が誰にいくら払えばいいかを自動計算。端数も1円までぴったり。" },
  { icon: BellRing, title: "払い忘れを防ぐ", body: "精算期限の通知とリマインドで、立替金の回収漏れをなくします。" },
  { icon: ChartPie, title: "お金の流れを見える化", body: "月別・カテゴリ別・メンバー別の支出をグラフで確認できます。" },
  { icon: ShieldCheck, title: "グループごとに安全に分離", body: "データベースの行単位アクセス制御で、他のグループの情報は見えません。" },
];

export default async function LandingPage() {
  if (readSupabaseConfig()) {
    const { user } = await getSession();
    if (user) redirect("/dashboard");
  }

  return (
    <div className="min-h-dvh bg-white">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
        <Logo />
        <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          ログイン
        </Link>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-0 bg-[radial-gradient(60%_60%_at_70%_0%,#e3f3ea_0%,transparent_70%)]" aria-hidden />
        <div className="relative mx-auto grid max-w-5xl items-center gap-10 px-5 pb-16 pt-10 lg:grid-cols-2 lg:pt-16">
          <div>
            <p className="mb-4 inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
              旅行・飲み会・ルームシェアの立替を、まとめて管理
            </p>
            <h1 className="text-[34px] font-extrabold leading-[1.25] tracking-tight text-ink sm:text-5xl sm:leading-[1.2]">
              みんなのお金を、
              <br />
              <span className="text-brand-600">気持ちよく精算。</span>
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-soft">
              「誰がいくら払った？」「誰に返せばいい？」をアプリが自動で計算。トークで流れていく立替のやり取りを、みんなで見られる一つの帳簿にします。
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "px-6")}>
                無料ではじめる <ArrowRight />
              </Link>
              <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "px-6")}>
                ログイン
              </Link>
            </div>
          </div>

          <div className="mx-auto w-full max-w-sm" aria-hidden>
            <div className="rounded-[28px] border border-line bg-white p-5 shadow-[0_30px_60px_-30px_rgb(16_40_30/0.35)]">
              <p className="text-xs font-semibold text-muted">沖縄旅行・4人</p>
              <p className="num mt-1 text-3xl font-extrabold text-ink">¥40,000</p>
              <div className="mt-5 space-y-3">
                {[
                  ["D", "#7C3AED", "A", "¥10,000"],
                  ["C", "#D97706", "B", "¥2,000"],
                ].map(([f, c, t, a]) => (
                  <div key={f} className="flex items-center gap-3 rounded-2xl bg-canvas p-3">
                    <span className="flex size-9 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: c }}>
                      {f}
                    </span>
                    <ArrowRight className="size-4 text-muted" />
                    <span className="flex size-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{t}</span>
                    <span className="num ml-auto font-bold text-ink">{a}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-center text-xs font-semibold text-brand-700">送金は2回で精算完了</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-canvas py-16">
        <div className="mx-auto max-w-5xl px-5">
          <h2 className="text-center text-2xl font-extrabold tracking-tight text-ink">割り勘のモヤモヤを、ぜんぶ解消</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-line bg-white p-5 shadow-card">
                <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon className="size-5" />
                </span>
                <p className="mt-4 font-bold text-ink">{title}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="py-10 text-center text-xs text-muted">
        © WariNote — 支払い状況を記録・共有するアプリです（実際の送金・決済は行いません）
      </footer>
    </div>
  );
}
