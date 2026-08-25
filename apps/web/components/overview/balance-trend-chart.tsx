"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatBRL } from "@/lib/utils";

interface DayBalance {
  day: number;
  balance: number;
}

interface BalanceTrendChartProps {
  data: DayBalance[];
}

// Área suave do saldo acumulado dia a dia no mês — tipo de gráfico diferente
// do pizza (composição) e da barra (comparação mensal) já existentes na
// Visão Geral. Elemento inspirado na tela "History" do kit
// finance-application-for-sketch (ver docs/ajustes-pos-teste.md).
export function BalanceTrendChart({ data }: BalanceTrendChartProps) {
  if (data.every((d) => d.balance === 0)) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        Sem movimentação neste mês ainda
      </div>
    );
  }

  const isNegative = (data.at(-1)?.balance ?? 0) < 0;
  const strokeColor = isNegative ? "var(--color-destructive)" : "var(--color-success)";

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="balanceTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            formatter={(value: number) => [formatBRL(value), "Saldo acumulado"]}
            labelFormatter={(day) => `Dia ${day}`}
            contentStyle={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "var(--color-foreground)",
            }}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke={strokeColor}
            strokeWidth={2}
            fill="url(#balanceTrendFill)"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
