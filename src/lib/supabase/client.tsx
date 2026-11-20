"use client";

import { createBrowserClient } from "@supabase/ssr";
import { createContext, useContext, useMemo, type ReactNode } from "react";

interface Config {
  url: string;
  anonKey: string;
}

const SupabaseConfigContext = createContext<Config | null>(null);

/** サーバーで読んだ接続設定をブラウザ側に渡す（ビルド時の環境変数に依存しない） */
export function SupabaseProvider({ url, anonKey, children }: Config & { children: ReactNode }) {
  const value = useMemo(() => ({ url, anonKey }), [url, anonKey]);
  return <SupabaseConfigContext.Provider value={value}>{children}</SupabaseConfigContext.Provider>;
}

/** ブラウザ用クライアント（Realtime 購読に使用） */
export function useSupabase() {
  const cfg = useContext(SupabaseConfigContext);
  return useMemo(() => (cfg?.url && cfg.anonKey ? createBrowserClient(cfg.url, cfg.anonKey) : null), [cfg]);
}
