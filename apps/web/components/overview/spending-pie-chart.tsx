"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatBRL } from "@/lib/utils";

interface CategorySpend {
  /** null = "Sem categoria". */
  categoryId: string | null;
  name: string;
  icon: string | null;
  total: number;
}

/** Período (e grupo, se for o gráfico de um grupo) que o clique detalha em Transações. */
export interface PieDrilldown {
  year: number;
  month: number;
  groupId?: string;
}

interface SpendingPieChartProps {
  data: CategorySpend[];
  totalExpense: number;
  /** Sem isto o gráfico é só leitura (nada clicável). */
  drilldown?: PieDrilldown;
}

// Paleta categórica do gráfico de gastos por categoria: precisa distinguir
// N categorias simultâneas, então foge da paleta restrita de status/marca
// (ver DESIGN.md) por natureza — mas troca a #6366f1 antiga (indigo da
// identidade anterior, anti-referência) por um tom neutro-azulado.
const SLICE_COLORS = [
  "#64748b", "#22c55e", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316", "#ec4899",
];

type ChartDatum = { categoryId: string | null; name: string; icon: string | null; value: number };

/** Transações daquela categoria, só gastos, no mês do gráfico. */
function transactionsHref(categoryId: string | null, d: PieDrilldown): string {
  const mm = String(d.month).padStart(2, "0");
  const lastDay = new Date(d.year, d.month, 0).getDate();
  const params = new URLSearchParams({
    categoryId: categoryId ?? "none",
    type: "expense",
    startDate: `${d.year}-${mm}-01`,
    endDate: `${d.year}-${mm}-${String(lastDay).padStart(2, "0")}`,
    ...(d.groupId && { groupId: d.groupId }),
  });
  return `/transactions?${params}`;
}

function formatShare(value: number, total: number): string {
  if (total <= 0) return "";
  const pct = (value / total) * 100;
  return pct < 1 ? "<1%" : `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: ChartDatum }>;
  total: number;
  clickable: boolean;
};

function CategoryTooltip({ active, payload, total, clickable }: TooltipProps) {
  const item = active ? payload?.[0]?.payload : undefined;
  if (!item) return null;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-xs max-w-[220px]">
      <p className="font-medium text-foreground truncate">
        {item.icon} {item.name}
      </p>
      <p className="mt-0.5 text-foreground">
        {formatBRL(item.value)}
        <span className="text-muted-foreground"> · {formatShare(item.value, total)} dos gastos</span>
      </p>
      {clickable && <p className="mt-1 text-muted-foreground">Clique para ver as transações</p>}
    </div>
  );
}

export function SpendingPieChart({ data, totalExpense, drilldown }: SpendingPieChartProps) {
  const router = useRouter();

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        Sem gastos neste mês
      </div>
    );
  }

  const chartData: ChartDatum[] = data.slice(0, 8).map((d) => ({
    categoryId: d.categoryId,
    name: d.name,
    icon: d.icon,
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
              isAnimationActive={false}
              // Fora da ordem de tabulação: no teclado o detalhamento é pelos
              // links da legenda abaixo. Sem isso o clique deixava um
              // contorno de foco retangular em volta da fatia.
              rootTabIndex={-1}
              onClick={
                drilldown
                  ? (_, index) => {
                      const item = chartData[index];
                      if (item) router.push(transactionsHref(item.categoryId, drilldown));
                    }
                  : undefined
              }
              className={drilldown ? "cursor-pointer" : undefined}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} strokeWidth={0} />
              ))}
            </Pie>
            {/* zIndex: o rótulo central (absolute, depois no DOM) ficava por
                cima do tooltip quando ele passava pelo meio da rosca. */}
            <Tooltip
              content={<CategoryTooltip total={totalExpense} clickable={!!drilldown} />}
              wrapperStyle={{ zIndex: 10 }}
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
      <div className="mt-3 space-y-0.5">
        {chartData.slice(0, 6).map((item, i) => {
          const content = (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }}
                />
                <span className="text-muted-foreground truncate">
                  {item.icon} {item.name}
                </span>
              </div>
              <span className="flex items-center gap-1 shrink-0 ml-2">
                <span className="font-medium text-foreground">{formatBRL(item.value)}</span>
                {drilldown && <ChevronRight size={14} className="text-muted-foreground" />}
              </span>
            </>
          );
          const rowClass = "flex items-center justify-between text-sm rounded-md px-1.5 py-1 -mx-1.5";

          return drilldown ? (
            <Link
              key={i}
              href={transactionsHref(item.categoryId, drilldown)}
              className={`${rowClass} hover:bg-accent transition-colors focus-visible:outline-2 focus-visible:outline-primary`}
            >
              {content}
            </Link>
          ) : (
            <div key={i} className={rowClass}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
