export type Transaction = {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: string;
  description: string;
  date: string;
  notes: string | null;
  isIgnored: boolean;
  source: string;
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
};

export type Budget = {
  id: string;
  name: string;
  amount: string;
  period: string;
  alertThreshold: string;
  category: { id: string; name: string; icon: string | null } | null;
  spentAmount: number;
  percentage: number;
  isOverBudget: boolean;
  isNearLimit: boolean;
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
  createdAt: string;
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
  category: { id: string; name: string; icon: string | null } | null;
  createdAt: string;
};
