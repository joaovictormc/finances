"use client";

import { useCallback, useEffect, useState } from "react";
import { PiggyBank, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Drawer } from "@/components/ui/drawer";
import { ProgressBar } from "@/components/ui/progress-bar";
import { CategoryIcon } from "@/components/ui/category-icon";
import { CurrencyInput } from "@/components/ui/currency-input";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import { api } from "@/lib/api-client";
import { cn, formatBRL } from "@/lib/utils";
import type { Budget, Category, Group } from "@/lib/types";

export default function BudgetsPage() {
  const { toast } = useToast();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [formKey, setFormKey] = useState(0);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [b, cats, grps] = await Promise.all([
        api.get<Budget[]>("/api/budgets", { year, month }),
        api.get<Category[]>("/api/categories", { type: "expense" }),
        api.get<Group[]>("/api/groups"),
      ]);
      setBudgets(b);
      setCategories(cats);
      setGroups(grps);
    } catch {
      toast({ title: "Erro ao carregar orçamentos", variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [year, month, toast]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setFormKey((k) => k + 1); setDrawerOpen(true); };
  const openEdit = (b: Budget) => { setEditing(b); setFormKey((k) => k + 1); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setEditing(null); };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Deletar este orçamento?")) return;
    try {
      await api.delete(`/api/budgets/${id}`);
      toast({ title: "Orçamento removido", variant: "success" });
      load();
    } catch {
      toast({ title: "Erro ao remover orçamento", variant: "error" });
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orçamentos</h1>
          <p className="text-muted-foreground text-sm mt-1">Controle de limites de gastos por categoria</p>
        </div>
        <Button onClick={openNew}>+ Novo Orçamento</Button>
      </div>

      {/* Onboarding explanation */}
      <div className="mb-6 flex gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
        <Info size={18} className="text-primary shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-foreground">O que são orçamentos?</p>
          <p className="text-muted-foreground mt-1">
            Orçamentos definem um <strong>limite de gasto por categoria no mês</strong>. Por exemplo:
            você define R$ 800 para Alimentação. O app mostra em tempo real quanto você já gastou
            e avisa quando estiver perto do limite — para você não ter surpresas no fim do mês.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : budgets.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm">
          <EmptyState
            icon={PiggyBank}
            title="Nenhum orçamento criado"
            description="Crie um orçamento para começar a controlar seus gastos por categoria"
            action={{ label: "+ Novo Orçamento", onClick: openNew }}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(() => {
            const featuredId = budgets
              .filter((b) => b.isOverBudget || b.isNearLimit)
              .slice()
              .sort((a, b) => b.percentage - a.percentage)[0]?.id;

            return budgets.map((b) => {
              const featured = b.id === featuredId;
              const fillColor = featured ? (b.isOverBudget ? "var(--color-destructive)" : "var(--color-warning)") : undefined;

              return (
                <div
                  key={b.id}
                  className={cn(
                    "rounded-2xl shadow-sm p-5 transition-shadow hover:shadow-md",
                    featured ? "text-white" : "bg-card border border-border/60"
                  )}
                  style={featured ? { backgroundColor: fillColor } : undefined}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {b.category && (
                        <CategoryIcon icon={b.category.icon} color={featured ? "#fff" : b.category.color} size="sm" />
                      )}
                      <div>
                        <p className={cn("font-semibold", featured ? "text-white" : "text-foreground")}>{b.name}</p>
                        {b.category && (
                          <p className={cn("text-xs mt-0.5", featured ? "text-white/75" : "text-muted-foreground")}>{b.category.name}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEdit(b)}
                        className={cn("text-xs px-2 py-1 rounded transition-colors", featured ? "text-white/80 hover:bg-white/15" : "text-muted-foreground hover:bg-accent")}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(b.id)}
                        className={cn("text-xs px-2 py-1 rounded transition-colors", featured ? "text-white/80 hover:bg-white/15" : "text-muted-foreground hover:text-destructive hover:bg-destructive/10")}
                      >
                        Remover
                      </button>
                    </div>
                  </div>

                  <ProgressBar value={b.percentage} showLabel className="mb-2" color={featured ? "#fff" : b.category?.color} trackClassName={featured ? "bg-white/20" : undefined} />

                  <div className="flex justify-between text-sm">
                    <span className={featured ? "text-white/85" : "text-muted-foreground"}>
                      {formatBRL(b.spentAmount)} gastos
                    </span>
                    <span className={cn(featured ? "text-white/85" : b.isOverBudget ? "text-destructive font-medium" : "text-muted-foreground")}>
                      limite: {formatBRL(Number(b.amount))}
                    </span>
                  </div>

                  {b.isOverBudget && (
                    <p className={cn("mt-2 text-xs font-medium", featured ? "text-white" : "text-destructive")}>
                      ⚠ Limite ultrapassado em {formatBRL(b.spentAmount - Number(b.amount))}
                    </p>
                  )}
                  {!b.isOverBudget && b.isNearLimit && (
                    <p className={cn("mt-2 text-xs font-medium", featured ? "text-white" : "text-warning")}>
                      ⚡ Perto do limite — {Math.round(b.percentage * 100)}% utilizado
                    </p>
                  )}
                </div>
              );
            });
          })()}
        </div>
      )}

      <Drawer open={drawerOpen} onClose={closeDrawer} title={editing ? "Editar Orçamento" : "Novo Orçamento"}>
        <BudgetForm
          key={formKey}
          budget={editing}
          categories={categories}
          groups={groups}
          year={year}
          month={month}
          onSuccess={() => { closeDrawer(); load(); }}
        />
      </Drawer>
    </div>
  );
}

function BudgetForm({
  budget,
  categories,
  groups,
  year,
  month,
  onSuccess,
}: {
  budget: Budget | null;
  categories: Category[];
  groups: Group[];
  year: number;
  month: number;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(budget?.name ?? "");
  const [amountCents, setAmountCents] = useState(Math.round(Number(budget?.amount ?? 0) * 100));
  const [categoryId, setCategoryId] = useState(budget?.category?.id ?? "");
  const [groupId, setGroupId] = useState(budget?.groupId ?? "");
  const [loading, setLoading] = useState(false);

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;

  const flatCats = categories.flatMap((c) => [c, ...(c.children ?? [])]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || amountCents <= 0) {
      toast({ title: "Preencha nome e valor", variant: "error" });
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        amount: amountCents / 100,
        period: "monthly",
        startDate,
        categoryId: categoryId || undefined,
        groupId: groupId || undefined,
      };
      if (budget) {
        await api.patch(`/api/budgets/${budget.id}`, payload);
        toast({ title: "Orçamento atualizado!", variant: "success" });
      } else {
        await api.post("/api/budgets", payload);
        toast({ title: "Orçamento criado!", variant: "success" });
      }
      onSuccess();
    } catch {
      toast({ title: "Erro ao salvar orçamento", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Alimentação mensal" autoFocus />
      <CurrencyInput label="Limite mensal" value={amountCents} onChange={setAmountCents} />
      <Select
        label="Categoria (opcional)"
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        placeholder="Todas as categorias"
        options={flatCats.map((c) => ({ value: c.id, label: `${c.icon ?? ""} ${c.name}`.trim() }))}
      />
      <Select
        label="Compartilhar com"
        value={groupId}
        onChange={(e) => setGroupId(e.target.value)}
        options={[{ value: "", label: "Pessoal" }, ...groups.map((g) => ({ value: g.id, label: g.name }))]}
      />
      <Button type="submit" loading={loading} className="w-full">
        {budget ? "Salvar alterações" : "Criar orçamento"}
      </Button>
    </form>
  );
}

