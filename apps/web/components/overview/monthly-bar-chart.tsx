"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatBRL } from "@/lib/utils";

interface MonthData {
  label: string;
  income: number;
  expense: number;
}

interface MonthlyBarChartProps {
  data: MonthData[];
}

const SHORT_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function MonthlyBarChart({ data }: MonthlyBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        Sem dados disponíveis
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barSize={14} barGap={4}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              formatBRL(value),
              name === "income" ? "Receitas" : "Gastos",
            ]}
            contentStyle={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "var(--color-foreground)",
            }}
          />
          <Legend
            formatter={(value) => (value === "income" ? "Receitas" : "Gastos")}
            wrapperStyle={{ fontSize: "12px" }}
          />
          <Bar dataKey="income" fill="#22c55e" radius={[3, 3, 0, 0]} />
          <Bar dataKey="expense" fill="#ef4444" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
