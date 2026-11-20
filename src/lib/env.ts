/**
 * Supabase の接続設定。実行時（Cloudflare Workers の vars / .env）に読み込む。
 * ビルド時に値が無くてもビルドできるよう、NEXT_PUBLIC_ に依存しない。
 */
export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function readSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "";
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function getSupabaseConfig(): SupabaseConfig {
  const cfg = readSupabaseConfig();
  if (!cfg) {
    throw new Error(
      "Supabase の接続設定がありません。環境変数 SUPABASE_URL と SUPABASE_ANON_KEY を設定してください。",
    );
  }
  return cfg;
}
