"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatBRL } from "@/lib/utils";

interface CategorySpend {
  name: string;
  icon: string | null;
  total: number;
}

interface SpendingPieChartProps {
  data: CategorySpend[];
  totalExpense: number;
}

const SLICE_COLORS = [
  "#6366f1", "#22c55e", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316", "#ec4899",
];

export function SpendingPieChart({ data, totalExpense }: SpendingPieChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        Sem gastos neste mês
      </div>
    );
  }

  const chartData = data.slice(0, 8).map((d) => ({
    name: d.name,
    value: d.total,
  }));

  return (
    <div>
      <div className="relative h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} strokeWidth={0} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [formatBRL(value), "Gasto"]}
              contentStyle={{
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "var(--color-foreground)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xs text-muted-foreground">Total gastos</span>
          <span className="text-base font-bold text-destructive">{formatBRL(totalExpense)}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 space-y-1.5">
        {data.slice(0, 6).map((item, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }}
              />
              <span className="text-muted-foreground truncate">
                {item.icon} {item.name}
              </span>
            </div>
            <span className="font-medium text-foreground shrink-0 ml-2">
              {formatBRL(item.total)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
