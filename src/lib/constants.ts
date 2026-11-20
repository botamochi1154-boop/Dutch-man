import {
  BedDouble,
  Beer,
  Briefcase,
  Ellipsis,
  Gamepad2,
  GraduationCap,
  Heart,
  House,
  Music,
  Package,
  Plane,
  ShoppingBag,
  TrainFront,
  Users,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import type { Category, GroupColor, GroupIconKey, Role, SplitMethod } from "./types";

export const APP_NAME = "WariNote";
export const APP_TAGLINE = "みんなのお金を、気持ちよく。";

/** 色は検証済みカテゴリパレット（固定順・色覚多様性チェック済み）。「その他」は中立グレー */
export const CATEGORIES: Record<Category, { label: string; icon: LucideIcon; color: string }> = {
  food: { label: "食費", icon: Utensils, color: "#EB6834" },
  drinks: { label: "飲み会", icon: Beer, color: "#2A78D6" },
  transport: { label: "交通費", icon: TrainFront, color: "#1BAF7A" },
  lodging: { label: "宿泊費", icon: BedDouble, color: "#EDA100" },
  shopping: { label: "買い物", icon: ShoppingBag, color: "#E87BA4" },
  daily: { label: "日用品", icon: Package, color: "#008300" },
  entertainment: { label: "娯楽", icon: Gamepad2, color: "#6250D6" },
  other: { label: "その他", icon: Ellipsis, color: "#8A948F" },
};
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

export const GROUP_ICONS: Record<GroupIconKey, { label: string; icon: LucideIcon }> = {
  users: { label: "友達", icon: Users },
  plane: { label: "旅行", icon: Plane },
  beer: { label: "飲み会", icon: Beer },
  heart: { label: "カップル", icon: Heart },
  house: { label: "ルームシェア", icon: House },
  graduation: { label: "大学・学校", icon: GraduationCap },
  music: { label: "サークル", icon: Music },
  briefcase: { label: "仕事", icon: Briefcase },
};
export const GROUP_ICON_KEYS = Object.keys(GROUP_ICONS) as GroupIconKey[];

export const GROUP_COLORS: Record<GroupColor, { label: string; fg: string; bg: string }> = {
  green: { label: "グリーン", fg: "#1F7A55", bg: "#E4F2EA" },
  teal: { label: "ティール", fg: "#11787A", bg: "#E0F2F1" },
  blue: { label: "ブルー", fg: "#2563AB", bg: "#E5EEF9" },
  indigo: { label: "インディゴ", fg: "#4B4FB0", bg: "#ECECFA" },
  rose: { label: "ローズ", fg: "#B83A5E", bg: "#FBE9EF" },
  amber: { label: "アンバー", fg: "#A9640B", bg: "#FBF1DF" },
  slate: { label: "スレート", fg: "#4A5A66", bg: "#ECEFF2" },
};
export const GROUP_COLOR_KEYS = Object.keys(GROUP_COLORS) as GroupColor[];

export const ROLE_LABELS: Record<Role, string> = { owner: "オーナー", admin: "管理者", member: "メンバー" };

export const SPLIT_METHODS: Record<SplitMethod, { label: string; hint: string }> = {
  equal: { label: "均等", hint: "選んだメンバーで均等に割ります" },
  exact: { label: "金額指定", hint: "一人ずつ金額を指定します" },
  percent: { label: "割合", hint: "一人ずつ割合（%）を指定します" },
};

export const AVATAR_COLORS = ["#1F7A55", "#2563EB", "#D97706", "#DB2777", "#7C3AED", "#0D9488", "#DC2626", "#475569"];

/** グラフの系列色（validate_palette.js で検証済みのペア） */
export const SERIES = {
  groupTotal: "#1F7A55",
  mine: "#E0A33A",
  paid: "#2A78D6",
  share: "#EB6834",
};
