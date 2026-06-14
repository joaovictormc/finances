import type { Metadata } from "next";
import { formatBRL, getMonthName } from "@/lib/utils";
import { api } from "@/lib/api-client";

export const metadata: Metadata = { title: "Visão Geral" };

type MonthlyReport = {
  year: number;
  month: number;
  income: number;
  expense: number;
  balance: number;
  byCategory: Array<{
    category: { id: string; name: string; icon: string; color: string } | null;
    total: number;
  }>;
};

async function getMonthlyReport(): Promise<MonthlyReport | null> {
  try {
    return await api.get<MonthlyReport>("/api/transactions/reports/monthly");
  } catch {
    return null;
  }
}

export default async function OverviewPage() {
  const report = await getMonthlyReport();
  const monthName = getMonthName();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Visão Geral</h1>
        <p className="text-muted-foreground text-sm mt-1">{monthName}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <KpiCard
          title="Receitas"
          value={report?.income ?? 0}
          color="text-success"
          icon="💚"
        />
        <KpiCard
          title="Gastos"
          value={report?.expense ?? 0}
          color="text-destructive"
          icon="❤️"
        />
        <KpiCard
          title="Saldo"
          value={report?.balance ?? 0}
          color={(report?.balance ?? 0) >= 0 ? "text-success" : "text-destructive"}
          icon={(report?.balance ?? 0) >= 0 ? "💙" : "🟠"}
        />
      </div>

      {/* Top spending categories */}
      {report && report.byCategory.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-6">
          <h2 className="font-semibold mb-4">Maiores Gastos por Categoria</h2>
          <div className="space-y-3">
            {report.byCategory.map((row, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{row.category?.icon ?? "📦"}</span>
                  <span className="text-sm">{row.category?.name ?? "Sem categoria"}</span>
                </div>
                <span className="text-sm font-medium">{formatBRL(row.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!report && (
        <div className="bg-muted rounded-lg p-8 text-center text-muted-foreground">
          <p className="text-lg">👋 Bem-vindo ao Financeiro!</p>
          <p className="mt-2 text-sm">
            Adicione suas primeiras transações ou conecte sua conta bancária para começar.
          </p>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  title,
  value,
  color,
  icon,
}: {
  title: string;
  value: number;
  color: string;
  icon: string;
}) {
  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{title}</span>
        <span>{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{formatBRL(value)}</p>
    </div>
  );
}
