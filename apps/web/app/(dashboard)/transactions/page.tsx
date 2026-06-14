import type { Metadata } from "next";
import { formatBRL, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Transações" };

export default function TransactionsPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transações</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Histórico de todas as suas movimentações
          </p>
        </div>
        <button className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity">
          + Nova Transação
        </button>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg border border-border p-4 mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Buscar transações..."
          className="flex-1 min-w-[200px] rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <select className="rounded-md border border-border bg-background px-3 py-2 text-sm">
          <option value="">Tipo</option>
          <option value="income">Receitas</option>
          <option value="expense">Gastos</option>
          <option value="transfer">Transferências</option>
        </select>
        <input
          type="date"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          type="date"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      {/* Empty state */}
      <div className="bg-card rounded-lg border border-border">
        <div className="p-8 text-center text-muted-foreground">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium">Nenhuma transação ainda</p>
          <p className="text-sm mt-1">
            Adicione manualmente ou conecte sua conta bancária via Open Finance
          </p>
        </div>
      </div>
    </div>
  );
}
