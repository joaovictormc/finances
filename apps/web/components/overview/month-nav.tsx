"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface MonthNavProps {
  year: number;
  month: number;
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function MonthNav({ year, month }: MonthNavProps) {
  const router = useRouter();

  const navigate = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    router.push(`/overview?year=${d.getFullYear()}&month=${d.getMonth() + 1}`);
  };

  const isCurrentMonth = (() => {
    const now = new Date();
    return year === now.getFullYear() && month === now.getMonth() + 1;
  })();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center justify-center w-8 h-8 rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="text-sm font-medium text-foreground min-w-[130px] text-center">
        {MONTH_NAMES[month - 1]} {year}
      </span>
      <button
        onClick={() => navigate(1)}
        disabled={isCurrentMonth}
        className="flex items-center justify-center w-8 h-8 rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
