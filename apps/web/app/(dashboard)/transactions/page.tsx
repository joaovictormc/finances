"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { TransactionFilters } from "@/components/transactions/transaction-filters";
import { TransactionList } from "@/components/transactions/transaction-list";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast-provider";
import { useConfirm } from "@/components/ui/confirm-provider";
import { api } from "@/lib/api-client";
import type { Category, FinancialAccount, Group, PaginatedResponse, Transaction } from "@/lib/types";
import type { CategorySuggestion } from "@finances/validations";

type Filters = {
  search: string;
  type: string;
  startDate: string;
  endDate: string;
  groupId: string;
};

const defaultFilters: Filters = { search: "", type: "", startDate: "", endDate: "", groupId: "" };

export default function TransactionsPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });
  const [formKey, setFormKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [suggestions, setSuggestions] = useState<Map<string, CategorySuggestion>>(new Map());
  const [isSuggesting, setIsSuggesting] = useState(false);

  const loadTransactions = useCallback(async (f: Filters, page = 1) => {
    setIsLoading(true);
    setSelectedIds(new Set());
    setBulkCategoryId("");
    try {
      const res = await api.get<PaginatedResponse<Transaction>>("/api/transactions", {
        ...(f.search && { search: f.search }),
        ...(f.type && { type: f.type }),
        ...(f.startDate && { startDate: f.startDate }),
        ...(f.endDate && { endDate: f.endDate }),
        ...(f.groupId && { groupId: f.groupId }),
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
    Promise.all([
      api.get<Category[]>("/api/categories"),
      api.get<FinancialAccount[]>("/api/accounts"),
      api.get<Group[]>("/api/groups"),
    ]).then(([cats, accs, grps]) => {
      setCategories(cats);
      setAccounts(accs);
      setGroups(grps);
    });
  }, []);

  useEffect(() => {
    loadTransactions(filters);
  }, [filters]);

  const openNew = () => { setEditing(null); setFormKey((k) => k + 1); setDrawerOpen(true); };
  const openEdit = (t: Transaction) => { setEditing(t); setFormKey((k) => k + 1); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setEditing(null); };

  // Atalho da grid de ações rápidas da Visão Geral (?new=1) — abre o modal de
  // criação direto e limpa o parâmetro da URL pra não reabrir num refresh.
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      openNew();
      router.replace(pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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

  const selectedTransactions = useMemo(
    () => transactions.filter((transaction) => selectedIds.has(transaction.id)),
    [selectedIds, transactions]
  );
  const selectedTypes = new Set(selectedTransactions.map((transaction) => transaction.type));
  const selectedType = selectedTypes.size === 1 ? selectedTransactions[0]?.type : undefined;
  const categoryOptions = categories
    .flatMap((category) => [category, ...(category.children ?? [])])
    .filter((category) => category.type === selectedType)
    .map((category) => ({ value: category.id, label: category.name }));

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < 100) next.add(id);
      return next;
    });
    setBulkCategoryId("");
  };

  const toggleAll = () => {
    const pageIds = transactions.map((transaction) => transaction.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.slice(0, Math.max(0, 100 - next.size)).forEach((id) => next.add(id));
      return next;
    });
    setBulkCategoryId("");
  };

  const handleBulkCategorize = async () => {
    if (!bulkCategoryId || selectedIds.size === 0) return;
    if (!(await confirm(`Definir a categoria de ${selectedIds.size} transações?`))) return;

    setIsBulkUpdating(true);
    try {
      const result = await api.patch<{ updated: number }>("/api/transactions/bulk-category", {
        transactionIds: [...selectedIds],
        categoryId: bulkCategoryId,
      });
      toast({ title: `${result.updated} transações categorizadas`, variant: "success" });
      setSelectedIds(new Set());
      setBulkCategoryId("");
      await loadTransactions(filters, meta.page);
    } catch (error) {
      toast({
        title: "Erro ao categorizar transações",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleSuggestCategories = async () => {
    const targetIds = selectedTransactions
      .filter((t) => !t.category)
      .map((t) => t.id)
      .slice(0, 50);
    if (targetIds.length === 0) {
      toast({ title: "Selecione transações sem categoria pra sugerir", variant: "error" });
      return;
    }
    setIsSuggesting(true);
    try {
      const { suggestions: result } = await api.post<{ suggestions: CategorySuggestion[] }>(
        "/api/transactions/suggest-categories",
        { transactionIds: targetIds }
      );
      setSuggestions((current) => {
        const next = new Map(current);
        for (const s of result) next.set(s.transactionId, s);
        return next;
      });
      const withSuggestion = result.filter((s) => s.categoryId).length;
      toast({
        title: withSuggestion > 0 ? `${withSuggestion} sugestões geradas` : "Nenhuma sugestão confiável encontrada",
        variant: withSuggestion > 0 ? "success" : "error",
      });
    } catch (error) {
      toast({
        title: "Erro ao sugerir categorias",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    } finally {
      setIsSuggesting(false);
    }
  };

  const applySuggestion = async (transactionId: string, categoryId: string) => {
    setSuggestions((current) => {
      const next = new Map(current);
      next.delete(transactionId);
      return next;
    });
    try {
      await api.patch(`/api/transactions/${transactionId}`, { categoryId });
      await loadTransactions(filters, meta.page);
    } catch {
      toast({ title: "Erro ao aplicar categoria sugerida", variant: "error" });
    }
  };

  const dismissSuggestion = (transactionId: string) => {
    setSuggestions((current) => {
      const next = new Map(current);
      next.delete(transactionId);
      return next;
    });
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transações</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Histórico de todas as suas movimentações
            {meta.total > 0 && ` · ${meta.total} transações`}
          </p>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-4 mb-4">
        <TransactionFilters filters={filters} groups={groups} onChange={setFilters} onNew={openNew} />
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="self-center text-sm font-medium">
            {selectedIds.size} {selectedIds.size === 1 ? "transação selecionada" : "transações selecionadas"}
          </p>
          <Select
            aria-label="Categoria para as transações selecionadas"
            value={bulkCategoryId}
            onChange={(event) => setBulkCategoryId(event.target.value)}
            options={categoryOptions}
            placeholder={selectedTypes.size > 1 ? "Selecione transações do mesmo tipo" : "Escolha a categoria"}
            disabled={selectedTypes.size !== 1}
            className="min-w-64"
          />
          <Button
            type="button"
            onClick={handleBulkCategorize}
            loading={isBulkUpdating}
            disabled={!bulkCategoryId}
          >
            Aplicar categoria
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleSuggestCategories}
            loading={isSuggesting}
          >
            Sugerir categoria (IA)
          </Button>
          <Button type="button" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Limpar seleção
          </Button>
        </div>
      )}

      <TransactionList
        transactions={transactions}
        isLoading={isLoading}
        selectedIds={selectedIds}
        onToggleSelected={toggleSelected}
        onToggleAll={toggleAll}
        onEdit={openEdit}
        onDelete={handleDelete}
        suggestions={suggestions}
        onApplySuggestion={applySuggestion}
        onDismissSuggestion={dismissSuggestion}
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

      <Modal
        open={drawerOpen}
        onClose={closeDrawer}
        title={editing ? "Editar Transação" : "Nova Transação"}
      >
        <TransactionForm
          key={formKey}
          transaction={editing}
          categories={categories}
          accounts={accounts}
          groups={groups}
          onSuccess={handleSuccess}
        />
      </Modal>
    </div>
  );
}
