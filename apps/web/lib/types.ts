export type Transaction = {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: string;
  description: string;
  date: string;
  notes: string | null;
  isIgnored: boolean;
  source: string;
  category: { id: string; name: string; icon: string | null; iconUrl?: string | null; color: string | null } | null;
  account: { id: string; name: string; institution: string | null; color: string | null };
  groupId?: string | null;
  group?: { id: string; name: string } | null;
  createdAt: string;
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type Category = {
  id: string;
  name: string;
  icon: string | null;
  iconUrl?: string | null;
  color: string | null;
  type: string;
  children: Category[];
};

export type FinancialAccount = {
  id: string;
  type: string;
  name: string;
  institution: string | null;
  color: string | null;
  groupId?: string | null;
  lastSyncedAt?: string | null;
};

export type Budget = {
  id: string;
  name: string;
  amount: string;
  period: string;
  alertThreshold: string;
  category: { id: string; name: string; icon: string | null; color: string | null } | null;
  spentAmount: number;
  percentage: number;
  isOverBudget: boolean;
  isNearLimit: boolean;
  groupId?: string | null;
};

export type Goal = {
  id: string;
  name: string;
  description: string | null;
  targetAmount: string;
  currentAmount: string;
  targetDate: string | null;
  icon: string | null;
  iconUrl?: string | null;
  color: string | null;
  isCompleted: boolean;
  groupId?: string | null;
  createdAt: string;
};

export type AiInsight = {
  id: string;
  type: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "success" | "critical";
  isRead: boolean;
  isDismissed: boolean;
  generatedAt: string;
};

export type GroupRole = "owner" | "admin" | "member" | "viewer";

export type Group = {
  id: string;
  name: string;
  ownerId: string;
  inviteCode: string;
  role: GroupRole;
  memberCount: number;
  createdAt: string;
};

export type GroupMember = {
  userId: string;
  name: string;
  email: string;
  role: GroupRole;
  joinedAt: string;
};

export type GroupDetail = Group & {
  members: GroupMember[];
};

export type RecurringBill = {
  id: string;
  name: string;
  expectedAmount: string | null;
  frequency: string;
  dayOfMonth: number | null;
  nextDueDate: string | null;
  lastPaidDate: string | null;
  isActive: boolean;
  category: { id: string; name: string; icon: string | null; iconUrl?: string | null } | null;
  createdAt: string;
};
