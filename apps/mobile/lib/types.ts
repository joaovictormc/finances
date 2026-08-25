import type { PaymentMethod } from "@finances/validations";

export type Transaction = {
  id: string;
  type: "income" | "expense" | "transfer";
  paymentMethod?: PaymentMethod;
  amount: string;
  description: string;
  date: string;
  notes: string | null;
  category: { id: string; name: string; icon: string | null; color: string | null } | null;
  account: { id: string; name: string; institution: string | null; color: string | null };
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
  hasCreditCard?: boolean;
};

export type GroupRole = "owner" | "admin" | "member" | "viewer";

export type Group = {
  id: string;
  name: string;
  ownerId?: string;
  inviteCode?: string;
  createdAt?: string;
  role?: GroupRole;
  memberCount?: number;
};

export type GroupMember = {
  userId: string;
  name: string;
  email: string;
  role: GroupRole;
  joinedAt: string;
};

export type GroupDetail = Group & {
  ownerId: string;
  inviteCode: string;
  createdAt: string;
  role: GroupRole;
  members: GroupMember[];
};

export type RecurringBill = {
  id: string;
  name: string;
  expectedAmount: string | null;
  frequency: "monthly" | "weekly" | "annual" | "custom";
  dayOfMonth: number | null;
  nextDueDate: string | null;
  isActive: boolean;
  category: { id: string; name: string; icon: string | null } | null;
};

export type Goal = {
  id: string;
  name: string;
  description: string | null;
  targetAmount: string;
  currentAmount: string;
  targetDate: string | null;
  icon: string | null;
  color: string | null;
  isCompleted: boolean;
  groupId: string | null;
};

export type Budget = {
  id: string;
  name: string;
  amount: string;
  period: "weekly" | "monthly" | "yearly";
  startDate: string;
  endDate: string | null;
  alertThreshold: string;
  category: { id: string; name: string; icon: string | null; color: string | null } | null;
  groupId: string | null;
  // Campos calculados pelo endpoint GET /api/budgets.
  spentAmount: number;
  percentage: number;
  isOverBudget: boolean;
  isNearLimit: boolean;
};

export type MonthlyReport = {
  income: number;
  expense: number;
  balance: number;
  byCategory: Array<{
    category: { id: string; name: string; icon: string | null; color: string | null } | null;
    total: number;
  }>;
};

export type DailyReport = {
  year: number;
  month: number;
  days: Array<{ day: number; balance: number }>;
};

export type PlanId = "free" | "pro" | "familia";

export type PlanDefinition = {
  id: PlanId;
  name: string;
  priceCents: number;
  maxBankConnections: number | null;
  historyMonths: number | null;
  channels: Array<"telegram" | "whatsapp">;
  aiInsights: boolean;
  maxGroupMembers: number;
};

export type Subscription = {
  plan: PlanId;
  status: string;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
  hasIntegrationsModule?: boolean;
  hasFamilyModule?: boolean;
};

export type AvailablePaymentMethods = {
  mercadopago: boolean;
  pix: boolean;
};

export type PixCheckout = {
  payload: string;
  txid: string;
  amount: number;
};

export type ReferralSummary = {
  total: number;
  rewardsGranted: number;
  referrals: Array<{ id: string; referredName: string; rewardGranted: boolean; createdAt: string }>;
};

export type NotificationPreferences = {
  notifyEmail: boolean;
  notifyTelegram: boolean;
  aiInsightsEnabled: boolean;
};
