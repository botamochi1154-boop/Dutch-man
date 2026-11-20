import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { SupabaseProvider } from "@/lib/supabase/client";
import { ToastProvider } from "@/components/ui/toast";
import { readSupabaseConfig } from "@/lib/env";

// すべてのページはログイン状態に依存するため、常にリクエスト時に描画する
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "WariNote | 割り勘・共有家計簿", template: "%s | WariNote" },
  description: "旅行・飲み会・ルームシェア。みんなで使ったお金の立替・割り勘・精算を、ひとつのアプリで。",
  applicationName: "WariNote",
  appleWebApp: { capable: true, title: "WariNote", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#1F7A55",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const cfg = readSupabaseConfig();
  return (
    <html lang="ja">
      <body>
        <SupabaseProvider url={cfg?.url ?? ""} anonKey={cfg?.anonKey ?? ""}>
          <ToastProvider>{children}</ToastProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}
