"use client";

import { useCallback, useEffect, useState } from "react";
import { TransactionFilters } from "@/components/transactions/transaction-filters";
import { TransactionList } from "@/components/transactions/transaction-list";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { Drawer } from "@/components/ui/drawer";
import { useToast } from "@/components/ui/toast-provider";
import { api } from "@/lib/api-client";
import type { Category, FinancialAccount, PaginatedResponse, Transaction } from "@/lib/types";

type Filters = {
  search: string;
  type: string;
  startDate: string;
  endDate: string;
};

const defaultFilters: Filters = { search: "", type: "", startDate: "", endDate: "" };

export default function TransactionsPage() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });
  const [formKey, setFormKey] = useState(0);

  const loadTransactions = useCallback(async (f: Filters, page = 1) => {
    setIsLoading(true);
    try {
      const res = await api.get<PaginatedResponse<Transaction>>("/api/transactions", {
        ...(f.search && { search: f.search }),
        ...(f.type && { type: f.type }),
        ...(f.startDate && { startDate: f.startDate }),
        ...(f.endDate && { endDate: f.endDate }),
        page,
        limit: 20,
      });
      setTransactions(res.data);
      setMeta(res.meta);
    } catch {
      toast({ title: "Erro ao carregar transações", variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadTransactions(filters);
    Promise.all([
      api.get<Category[]>("/api/categories"),
      api.get<FinancialAccount[]>("/api/accounts"),
    ]).then(([cats, accs]) => {
      setCategories(cats);
      setAccounts(accs);
    });
  }, []);

  useEffect(() => {
    loadTransactions(filters);
  }, [filters]);

  const openNew = () => { setEditing(null); setFormKey((k) => k + 1); setDrawerOpen(true); };
  const openEdit = (t: Transaction) => { setEditing(t); setFormKey((k) => k + 1); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setEditing(null); };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/transactions/${id}`);
      toast({ title: "Transação deletada", variant: "success" });
      loadTransactions(filters);
    } catch {
      toast({ title: "Erro ao deletar transação", variant: "error" });
    }
  };

  const handleSuccess = () => {
    closeDrawer();
    loadTransactions(filters);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Transações</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Histórico de todas as suas movimentações
          {meta.total > 0 && ` · ${meta.total} transações`}
        </p>
      </div>

      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-4 mb-4">
        <TransactionFilters filters={filters} onChange={setFilters} onNew={openNew} />
      </div>

      <TransactionList
        transactions={transactions}
        isLoading={isLoading}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Mostrando {transactions.length} de {meta.total}
          </p>
          <div className="flex gap-2">
            <button
              disabled={meta.page <= 1}
              onClick={() => loadTransactions(filters, meta.page - 1)}
              className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent disabled:opacity-50"
            >
              ← Anterior
            </button>
            <button
              disabled={meta.page >= meta.totalPages}
              onClick={() => loadTransactions(filters, meta.page + 1)}
              className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent disabled:opacity-50"
            >
              Próxima →
            </button>
          </div>
        </div>
      )}

      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editing ? "Editar Transação" : "Nova Transação"}
      >
        <TransactionForm
          key={formKey}
          transaction={editing}
          categories={categories}
          accounts={accounts}
          onSuccess={handleSuccess}
        />
      </Drawer>
    </div>
  );
}
