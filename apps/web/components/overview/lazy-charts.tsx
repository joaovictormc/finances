"use client";

import dynamic from "next/dynamic";

// O recharts é a maior dependência da Visão Geral. Carregado sob demanda, ele
// sai do bundle inicial: o resto da página aparece e fica interativo antes, e
// os gráficos chegam depois no lugar do esqueleto. Sem SSR porque o
// ResponsiveContainer não tem largura no servidor — renderizava vazio de todo jeito.
// Fica num arquivo "use client" porque `ssr: false` não é permitido em server
// component (a página é um).

function ChartSkeleton({ className }: { className: string }) {
  return <div className={`${className} animate-pulse rounded-xl bg-muted/50`} />;
}

export const SpendingPieChart = dynamic(
  () => import("./spending-pie-chart").then((m) => m.SpendingPieChart),
  { ssr: false, loading: () => <ChartSkeleton className="h-52" /> }
);

export const MonthlyBarChart = dynamic(
  () => import("./monthly-bar-chart").then((m) => m.MonthlyBarChart),
  { ssr: false, loading: () => <ChartSkeleton className="h-64" /> }
);

export const BalanceTrendChart = dynamic(
  () => import("./balance-trend-chart").then((m) => m.BalanceTrendChart),
  { ssr: false, loading: () => <ChartSkeleton className="h-64" /> }
);
