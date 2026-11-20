export type Role = "owner" | "admin" | "member";
export type Category =
  | "food"
  | "drinks"
  | "transport"
  | "lodging"
  | "shopping"
  | "daily"
  | "entertainment"
  | "other";
export type GroupIconKey = "users" | "plane" | "beer" | "heart" | "house" | "graduation" | "music" | "briefcase";
export type GroupColor = "green" | "teal" | "blue" | "indigo" | "rose" | "amber" | "slate";
export type SplitMethod = "equal" | "exact" | "percent";
export type SettlementStatus = "pending" | "confirmed" | "rejected" | "cancelled";

export interface Profile {
  id: string;
  display_name: string;
  avatar_color: string;
}
export type PeopleMap = Record<string, Profile>;

export interface Group {
  id: string;
  name: string;
  description: string | null;
  icon: GroupIconKey;
  color: GroupColor;
  join_approval_required: boolean;
  settlement_due_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;
  group_id: string;
  user_id: string;
  role: Role;
  joined_at: string;
  left_at: string | null;
}

export interface Expense {
  id: string;
  group_id: string;
  title: string;
  amount: number;
  paid_by: string;
  category: Category;
  spent_on: string;
  memo: string | null;
  split_method: SplitMethod;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  group_id: string;
  user_id: string;
  share_amount: number;
  input_value: number | null;
}

export interface Settlement {
  id: string;
  group_id: string;
  from_user: string;
  to_user: string;
  amount: number;
  status: SettlementStatus;
  note: string | null;
  created_by: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BalanceRow {
  group_id: string;
  user_id: string;
  paid: number;
  share: number;
  sent: number;
  received: number;
  pending_out: number;
  pending_in: number;
  balance: number;
  effective_balance: number;
}

export interface Invitation {
  id: string;
  group_id: string;
  token: string;
  created_by: string | null;
  expires_at: string;
  max_uses: number | null;
  use_count: number;
  revoked_at: string | null;
  created_at: string;
}

export interface JoinRequest {
  id: string;
  group_id: string;
  user_id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  group_id: string | null;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  group_id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface GroupOverview {
  group_id: string;
  name: string;
  icon: GroupIconKey;
  color: GroupColor;
  role: Role;
  member_count: number;
  total_spent: number;
  settlement_due_date: string | null;
  pending_to_confirm: number;
  my_pending_out: number;
  last_activity_at: string | null;
}

export interface InvitationPreview {
  status: "valid" | "invalid" | "revoked" | "expired" | "exhausted" | "already_member" | "pending_request";
  group_id: string | null;
  group_name: string | null;
  group_icon: GroupIconKey | null;
  group_color: GroupColor | null;
  member_count: number | null;
  inviter_name: string | null;
  requires_approval: boolean | null;
  expires_at: string | null;
}

export type ActionResult = { ok: true; message?: string; id?: string } | { ok: false; error: string };

/** useActionState 用のフォーム状態 */
export type FormState = { error?: string; success?: string } | null;
