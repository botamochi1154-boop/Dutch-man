import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";
import type {
  ActivityLog,
  AppNotification,
  BalanceRow,
  Expense,
  ExpenseSplit,
  Group,
  GroupOverview,
  Invitation,
  JoinRequest,
  Member,
  PeopleMap,
  Profile,
  Settlement,
} from "@/lib/types";

/**
 * データ取得はすべてログイン中ユーザーの権限で行う（RLS により所属グループのデータしか返らない）。
 */

type Res<T> = { data: T | null; error: { message: string } | null };
function must<T>(res: Res<T>, fallback: T): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? fallback) as T;
}

export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
});

export async function requireUser() {
  const { supabase, user } = await getSession();
  if (!user) redirect("/login");
  return { supabase, user };
}

export const getMyProfile = cache(async (): Promise<Profile & { email: string }> => {
  const { supabase, user } = await requireUser();
  const res = await supabase.from("profiles").select("id, display_name, avatar_color").eq("id", user.id).maybeSingle();
  const p = must<Profile | null>(res, null);
  return {
    id: user.id,
    display_name: p?.display_name ?? user.email?.split("@")[0] ?? "ユーザー",
    avatar_color: p?.avatar_color ?? "#1F7A55",
    email: user.email ?? "",
  };
});

/** 自分と、同じグループのメンバーのプロフィール（RLS で他人は返らない） */
export async function getPeople(db: ServerSupabase): Promise<PeopleMap> {
  const rows = must<Profile[]>(await db.from("profiles").select("id, display_name, avatar_color"), []);
  return Object.fromEntries(rows.map((p) => [p.id, p]));
}

export async function getOverview(db: ServerSupabase): Promise<GroupOverview[]> {
  return must<GroupOverview[]>(await db.rpc("my_group_overview"), []);
}

export async function getMyBalances(db: ServerSupabase): Promise<BalanceRow[]> {
  return must<BalanceRow[]>(await db.rpc("my_balances"), []);
}

export const getGroupContext = cache(async (groupId: string) => {
  if (!isUuid(groupId)) notFound();
  const { supabase, user } = await requireUser();
  const [g, m, people] = await Promise.all([
    supabase.from("groups").select("*").eq("id", groupId).maybeSingle(),
    supabase.from("group_members").select("*").eq("group_id", groupId).order("joined_at").order("user_id"),
    getPeople(supabase),
  ]);
  const group = must<Group | null>(g, null);
  if (!group) notFound();
  const members = must<Member[]>(m, []);
  const me = members.find((x) => x.user_id === user.id && !x.left_at);
  if (!me) notFound();
  return {
    supabase,
    user,
    group,
    members,
    activeMembers: members.filter((x) => !x.left_at),
    me,
    isAdmin: me.role === "owner" || me.role === "admin",
    people,
  };
});

export async function getGroupBalances(db: ServerSupabase, groupId: string): Promise<BalanceRow[]> {
  return must<BalanceRow[]>(await db.rpc("group_balances", { p_group_id: groupId }), []);
}

export async function getExpenses(
  db: ServerSupabase,
  opts: { groupId?: string; groupIds?: string[]; limit?: number; since?: string; category?: string } = {},
): Promise<Expense[]> {
  let q = db.from("expenses").select("*").is("deleted_at", null);
  if (opts.groupId) q = q.eq("group_id", opts.groupId);
  if (opts.groupIds) q = q.in("group_id", opts.groupIds.length ? opts.groupIds : ["00000000-0000-0000-0000-000000000000"]);
  if (opts.since) q = q.gte("spent_on", opts.since);
  if (opts.category) q = q.eq("category", opts.category);
  q = q.order("spent_on", { ascending: false }).order("created_at", { ascending: false }).limit(opts.limit ?? 500);
  return must<Expense[]>(await q, []);
}

export async function getSplits(db: ServerSupabase, opts: { expenseIds?: string[]; userId?: string; groupIds?: string[] }) {
  let q = db.from("expense_splits").select("*");
  if (opts.expenseIds) q = q.in("expense_id", opts.expenseIds.length ? opts.expenseIds : ["00000000-0000-0000-0000-000000000000"]);
  if (opts.userId) q = q.eq("user_id", opts.userId);
  if (opts.groupIds) q = q.in("group_id", opts.groupIds.length ? opts.groupIds : ["00000000-0000-0000-0000-000000000000"]);
  return must<ExpenseSplit[]>(await q.limit(5000), []);
}

export async function getExpenseDetail(db: ServerSupabase, groupId: string, expenseId: string) {
  if (!isUuid(expenseId)) notFound();
  const [e, s] = await Promise.all([
    db.from("expenses").select("*").eq("id", expenseId).eq("group_id", groupId).maybeSingle(),
    db.from("expense_splits").select("*").eq("expense_id", expenseId).order("share_amount", { ascending: false }),
  ]);
  const expense = must<Expense | null>(e, null);
  if (!expense) notFound();
  return { expense, splits: must<ExpenseSplit[]>(s, []) };
}

export async function getSettlements(db: ServerSupabase, groupId: string): Promise<Settlement[]> {
  return must<Settlement[]>(
    await db.from("settlements").select("*").eq("group_id", groupId).order("created_at", { ascending: false }).limit(300),
    [],
  );
}

export async function hasConfirmedSettlementAfter(db: ServerSupabase, groupId: string, createdAt: string) {
  const res = await db
    .from("settlements")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId)
    .eq("status", "confirmed")
    .gt("confirmed_at", createdAt);
  if (res.error) throw new Error(res.error.message);
  return (res.count ?? 0) > 0;
}

export async function getActivity(
  db: ServerSupabase,
  opts: { groupId?: string; entityId?: string; limit?: number } = {},
): Promise<ActivityLog[]> {
  let q = db.from("activity_logs").select("*");
  if (opts.groupId) q = q.eq("group_id", opts.groupId);
  if (opts.entityId) q = q.eq("entity_id", opts.entityId);
  return must<ActivityLog[]>(await q.order("created_at", { ascending: false }).limit(opts.limit ?? 20), []);
}

export async function getInvitations(db: ServerSupabase, groupId: string): Promise<Invitation[]> {
  return must<Invitation[]>(
    await db
      .from("group_invitations")
      .select("*")
      .eq("group_id", groupId)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
    [],
  );
}

export async function getJoinRequests(db: ServerSupabase, groupId: string): Promise<JoinRequest[]> {
  return must<JoinRequest[]>(
    await db.from("group_join_requests").select("*").eq("group_id", groupId).eq("status", "pending").order("created_at"),
    [],
  );
}

/** 承認待ちの申請者名は profiles の RLS では見えないため、申請情報から表示用に補う */
export async function getRequesterNames(db: ServerSupabase, userIds: string[]): Promise<PeopleMap> {
  if (!userIds.length) return {};
  const rows = must<Profile[]>(await db.from("profiles").select("id, display_name, avatar_color").in("id", userIds), []);
  return Object.fromEntries(rows.map((p) => [p.id, p]));
}

export async function getNotifications(db: ServerSupabase, limit = 50): Promise<AppNotification[]> {
  return must<AppNotification[]>(
    await db.from("notifications").select("*").order("created_at", { ascending: false }).limit(limit),
    [],
  );
}

export async function getUnreadCount(db: ServerSupabase): Promise<number> {
  const res = await db.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  if (res.error) return 0;
  return res.count ?? 0;
}
