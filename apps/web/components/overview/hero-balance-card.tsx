import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatBRL } from "@/lib/utils";

interface HeroBalanceCardProps {
  balance: number;
  income: number;
  expense: number;
}

export function HeroBalanceCard({ balance, income, expense }: HeroBalanceCardProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground">
      <span className="absolute -right-12 -top-16 w-56 h-56 rounded-[40%] bg-white/10 rotate-12" />
      <span className="absolute -right-4 bottom-0 w-32 h-32 rounded-[35%] bg-white/10 -rotate-12" />

      <div className="relative z-10">
        <p className="text-sm font-medium text-primary-foreground/75">Saldo do mês</p>
        <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight">
          {formatBRL(balance)}
        </p>

        <div className="mt-5 flex rounded-2xl bg-black/15 overflow-hidden">
          <div className="flex-1 flex items-center gap-2 px-4 py-3">
            <ArrowDownRight size={16} className="text-success shrink-0" />
            <div>
              <p className="text-xs text-primary-foreground/70">Receitas</p>
              <p className="text-sm font-semibold tabular-nums">{formatBRL(income)}</p>
            </div>
          </div>
          <div className="w-px bg-white/15 my-2" />
          <div className="flex-1 flex items-center gap-2 px-4 py-3">
            <ArrowUpRight size={16} className="text-destructive shrink-0" />
            <div>
              <p className="text-xs text-primary-foreground/70">Gastos</p>
              <p className="text-sm font-semibold tabular-nums">{formatBRL(expense)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
