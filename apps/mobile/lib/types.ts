export type Transaction = {
  id: string;
  type: "income" | "expense" | "transfer";
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
};

export type Group = {
  id: string;
  name: string;
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

export type MonthlyReport = {
  income: number;
  expense: number;
  balance: number;
  byCategory: Array<{
    category: { id: string; name: string; icon: string | null; color: string | null } | null;
    total: number;
  }>;
};
