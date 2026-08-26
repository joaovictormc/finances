import type { Metadata } from "next";
import Link from "next/link";
import { formatBRL } from "@/lib/utils";
import { serverApiGet } from "@/lib/api-server";
import { MonthNav } from "@/components/overview/month-nav";
import { SpendingPieChart } from "@/components/overview/spending-pie-chart";
import { MonthlyBarChart } from "@/components/overview/monthly-bar-chart";
import { BalanceTrendChart } from "@/components/overview/balance-trend-chart";
import { HeroBalanceCard } from "@/components/overview/hero-balance-card";
import { QuickActions } from "@/components/overview/quick-actions";
import { GoalsPreview } from "@/components/overview/goals-preview";
import { GamificationCard } from "@/components/overview/gamification-card";
import { RecentTransactions } from "@/components/overview/recent-transactions";
import { UpcomingBills } from "@/components/overview/upcoming-bills";
import { InsightsPanel } from "@/components/insights/insights-panel";
import { AiQueryBox } from "@/components/insights/ai-query-box";
import type { Goal, RecurringBill, PaginatedResponse, Transaction } from "@/lib/types";

export const metadata: Metadata = { title: "Visão Geral" };

const SHORT_MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

type MonthlyReport = {
  income: number;
  expense: number;
  balance: number;
  byCategory: Array<{
    category: { id: string; name: string; icon: string; color: string } | null;
    total: number;
  }>;
};

async function fetchReport(year: number, month: number): Promise<MonthlyReport | null> {
  return serverApiGet<MonthlyReport>("/api/transactions/reports/monthly", { year, month });
}

type DailyReport = { day: number; balance: number }[];

async function fetchDaily(year: number, month: number): Promise<DailyReport> {
  const res = await serverApiGet<{ days: { day: number; balance: number }[] }>(
    "/api/transactions/reports/daily",
    { year, month }
  );
  return res.days;
}

async function fetchGoals(): Promise<Goal[]> {
  return serverApiGet<Goal[]>("/api/goals");
}

async function fetchBills(): Promise<RecurringBill[]> {
  return serverApiGet<RecurringBill[]>("/api/bills");
}

async function fetchRecentTransactions(): Promise<Transaction[]> {
  const res = await serverApiGet<PaginatedResponse<Transaction>>("/api/transactions", {
    page: 1,
    limit: 6,
  });
  return res.data;
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = parseInt(params.year ?? now.getFullYear().toString());
  const month = parseInt(params.month ?? (now.getMonth() + 1).toString());

  // Fetch current month + 5 previous months in parallel
  const sixMonths = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, month - 1 - (5 - i), 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });

  const [currentReport, goals, bills, recentTransactions, dailyBalance, ...historyReports] = await Promise.all([
    fetchReport(year, month),
    fetchGoals(),
    fetchBills(),
    fetchRecentTransactions(),
    fetchDaily(year, month),
    ...sixMonths.slice(0, 5).map((m) => fetchReport(m.year, m.month)),
  ]);

  // Build bar chart data (5 history months + current)
  const barData = [
    ...sixMonths.slice(0, 5).map((m, i) => ({
      label: SHORT_MONTHS[m.month - 1],
      income: historyReports[i]?.income ?? 0,
      expense: historyReports[i]?.expense ?? 0,
    })),
    {
      label: SHORT_MONTHS[month - 1],
      income: currentReport?.income ?? 0,
      expense: currentReport?.expense ?? 0,
    },
  ];

  // Pie chart data from byCategory
  const pieData = (currentReport?.byCategory ?? [])
    .filter((row) => row.total > 0)
    .map((row) => ({
      name: row.category?.name ?? "Sem categoria",
      icon: row.category?.icon ?? null,
      total: row.total,
    }));

  const balance = currentReport?.balance ?? 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Visão Geral</h1>
          <p className="text-muted-foreground text-sm mt-1">Resumo financeiro do mês</p>
        </div>
        <MonthNav year={year} month={month} />
      </div>

      {/* Hero balance + metas */}
      <div className="mb-6 grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2">
          <HeroBalanceCard
            balance={balance}
            income={currentReport?.income ?? 0}
            expense={currentReport?.expense ?? 0}
          />
        </div>
        <div className="lg:col-span-3">
          <GoalsPreview goals={goals} />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
        <div className="lg:col-span-2">
          <QuickActions />
        </div>
        <div className="lg:col-span-3">
          <GamificationCard />
        </div>
      </div>

      <InsightsPanel />
      <AiQueryBox />

      {!currentReport ? (
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-10 text-center text-muted-foreground mb-6">
          <p className="text-2xl mb-2">📊</p>
          <p className="font-medium">Sem dados para este mês</p>
          <p className="text-sm mt-1">Adicione transações para ver o resumo aqui</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Pie chart */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
            <h2 className="font-semibold mb-4 text-foreground">Gastos por Categoria</h2>
            <SpendingPieChart data={pieData} totalExpense={currentReport.expense} />
          </div>

          {/* Bar chart */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
            <h2 className="font-semibold mb-4 text-foreground">Receitas vs Gastos — 6 meses</h2>
            <MonthlyBarChart data={barData} />
          </div>

          {/* Trend chart */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 lg:col-span-2">
            <h2 className="font-semibold mb-4 text-foreground">Saldo Acumulado no Mês</h2>
            <BalanceTrendChart data={dailyBalance} />
          </div>
        </div>
      )}

      {/* Recent transactions + upcoming bills */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <RecentTransactions transactions={recentTransactions} />
        </div>
        <div className="lg:col-span-2">
          <UpcomingBills bills={bills} />
        </div>
      </div>
    </div>
  );
}
