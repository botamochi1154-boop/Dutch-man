const MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "ログインの有効期限が切れました。もう一度ログインしてください。",
  NOT_MEMBER: "このグループのメンバーではありません。",
  FORBIDDEN: "この操作を行う権限がありません。",
  NOT_FOUND: "対象が見つかりませんでした。画面を更新してください。",
  EXPENSE_NOT_FOUND: "支出が見つかりません（削除された可能性があります）。",
  INVALID_TITLE: "タイトルは1〜60文字で入力してください。",
  INVALID_AMOUNT: "金額は1円〜1億円の整数で入力してください。",
  INVALID_DATE: "日付が正しくありません。",
  INVALID_MEMO: "メモは500文字以内で入力してください。",
  INVALID_INPUT: "入力内容を確認してください。",
  INVALID_NAME: "グループ名は1〜40文字で入力してください。",
  NO_PARTICIPANTS: "割り勘の対象者を1人以上選んでください。",
  DUPLICATE_PARTICIPANT: "対象者が重複しています。",
  INVALID_SPLIT: "負担額の指定が正しくありません。",
  SPLIT_SUM_MISMATCH: "各メンバーの金額の合計が支出額と一致していません。",
  PERCENT_SUM_MISMATCH: "割合の合計を100%にしてください。",
  PAYER_NOT_MEMBER: "支払った人がグループのメンバーではありません。",
  PARTICIPANT_NOT_MEMBER: "グループのメンバー以外は割り勘の対象にできません。",
  CONFLICT: "他のメンバーが先にこの支出を編集しました。最新の内容を確認してから保存してください。",
  SETTLED_CONFIRM_REQUIRED: "この支出は精算済みの期間に含まれています。確認のチェックを入れてから保存してください。",
  PENDING_EXISTS: "この相手への支払い申告がすでに確認待ちです。",
  NOTHING_TO_SETTLE: "精算が必要な金額がありません。画面を更新して最新の状態を確認してください。",
  SETTLEMENT_EXCEEDS: "精算額が未精算の金額を超えています。",
  INVALID_STATE: "すでに処理されています。画面を更新してください。",
  MEMBER_HAS_BALANCE: "未精算の金額があるため外せません。先に精算を完了してください。",
  OWNER_CANNOT_LEAVE: "オーナーは退出できません。不要になったグループは削除してください。",
  INVITATION_INVALID: "招待リンクが正しくありません。",
  INVITATION_EXPIRED: "招待リンクの有効期限が切れているか、無効化されています。",
  GROUP_FULL: "グループの人数が上限（50人）に達しています。",
  TOO_MANY_INVITATIONS: "有効な招待リンクが多すぎます。不要なリンクを無効化してください。",
  TOO_MANY_GROUPS: "参加できるグループ数の上限に達しています。",
};

export function errorCode(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return String(error ?? "");
}

/** DB の例外コード等を、利用者向けの日本語に変換 */
export function toMessage(error: unknown): string {
  const msg = errorCode(error);
  if (MESSAGES[msg]) return MESSAGES[msg];
  const hit = Object.keys(MESSAGES).find((k) => new RegExp(`\\b${k}\\b`).test(msg));
  if (hit) return MESSAGES[hit];
  if (/permission denied|row-level security/i.test(msg)) return MESSAGES.FORBIDDEN;
  if (/fetch failed|network|timeout/i.test(msg)) return "通信エラーが発生しました。電波の良い場所でもう一度お試しください。";
  if (/JWT|session/i.test(msg)) return MESSAGES.NOT_AUTHENTICATED;
  console.error("[WariNote] unexpected error:", msg);
  return "エラーが発生しました。時間をおいてもう一度お試しください。";
}

/** Supabase Auth のエラーを日本語に */
export function authMessage(error: { code?: string; message?: string; status?: number } | null | undefined): string {
  const code = error?.code ?? "";
  const msg = error?.message ?? "";
  if (code === "invalid_credentials" || /Invalid login credentials/i.test(msg))
    return "メールアドレスまたはパスワードが正しくありません。";
  if (code === "email_not_confirmed" || /Email not confirmed/i.test(msg))
    return "メールアドレスの確認が完了していません。届いた確認メールのリンクを開いてください。";
  if (code === "user_already_exists" || /already registered/i.test(msg)) return "このメールアドレスはすでに登録されています。";
  if (code === "weak_password" || /Password should/i.test(msg)) return "パスワードは8文字以上で、推測されにくいものにしてください。";
  if (code === "same_password") return "現在と同じパスワードは使えません。";
  if (code.includes("rate_limit") || error?.status === 429) return "短時間に操作が集中しています。少し時間をおいてお試しください。";
  if (code === "validation_failed" || /invalid format/i.test(msg)) return "メールアドレスの形式が正しくありません。";
  return "認証でエラーが発生しました。時間をおいてもう一度お試しください。";
}
