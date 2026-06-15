import type { Metadata } from "next";
import { formatBRL } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { MonthNav } from "@/components/overview/month-nav";
import { SpendingPieChart } from "@/components/overview/spending-pie-chart";
import { MonthlyBarChart } from "@/components/overview/monthly-bar-chart";

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
  try {
    return await api.get<MonthlyReport>("/api/transactions/reports/monthly", { year, month });
  } catch {
    return null;
  }
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

  const [currentReport, ...historyReports] = await Promise.all([
    fetchReport(year, month),
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          title="Receitas"
          value={currentReport?.income ?? 0}
          valueClass="text-success"
          prefix="+"
        />
        <KpiCard
          title="Gastos"
          value={currentReport?.expense ?? 0}
          valueClass="text-destructive"
          prefix="-"
        />
        <KpiCard
          title="Saldo"
          value={balance}
          valueClass={balance >= 0 ? "text-success" : "text-destructive"}
          prefix={balance >= 0 ? "+" : ""}
        />
      </div>

      {!currentReport ? (
        <div className="bg-card rounded-lg border border-border p-10 text-center text-muted-foreground">
          <p className="text-2xl mb-2">📊</p>
          <p className="font-medium">Sem dados para este mês</p>
          <p className="text-sm mt-1">Adicione transações para ver o resumo aqui</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie chart */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="font-semibold mb-4 text-foreground">Gastos por Categoria</h2>
            <SpendingPieChart data={pieData} totalExpense={currentReport.expense} />
          </div>

          {/* Bar chart */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="font-semibold mb-4 text-foreground">Receitas vs Gastos — 6 meses</h2>
            <MonthlyBarChart data={barData} />
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  title,
  value,
  valueClass,
  prefix = "",
}: {
  title: string;
  value: number;
  valueClass: string;
  prefix?: string;
}) {
  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <p className="text-sm text-muted-foreground mb-1">{title}</p>
      <p className={`text-2xl font-bold tabular-nums ${valueClass}`}>
        {prefix}{formatBRL(value)}
      </p>
    </div>
  );
}
