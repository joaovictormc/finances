"use client";

import { useCallback, useEffect, useState } from "react";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Drawer } from "@/components/ui/drawer";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import { api } from "@/lib/api-client";
import { formatBRL, formatDate } from "@/lib/utils";
import type { Goal } from "@/lib/types";

export default function GoalsPage() {
  const { toast } = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get<Goal[]>("/api/goals");
      setGoals(data);
    } catch {
      toast({ title: "Erro ao carregar metas", variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setDrawerOpen(true); };
  const openEdit = (g: Goal) => { setEditing(g); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setEditing(null); };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Deletar esta meta?")) return;
    try {
      await api.delete(`/api/goals/${id}`);
      toast({ title: "Meta removida", variant: "success" });
      load();
    } catch {
      toast({ title: "Erro ao remover meta", variant: "error" });
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Metas Financeiras</h1>
          <p className="text-muted-foreground text-sm mt-1">Acompanhe seus objetivos de poupança</p>
        </div>
        <Button onClick={openNew}>+ Nova Meta</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : goals.length === 0 ? (
        <div className="bg-card rounded-lg border border-border">
          <EmptyState
            icon={Target}
            title="Nenhuma meta criada"
            description="Defina objetivos financeiros como viagem, fundo de emergência ou compra de um bem"
            action={{ label: "+ Nova Meta", onClick: openNew }}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {goals.map((g) => {
            const pct = Number(g.targetAmount) > 0
              ? Number(g.currentAmount) / Number(g.targetAmount)
              : 0;
            const daysLeft = g.targetDate
              ? Math.ceil((new Date(g.targetDate).getTime() - Date.now()) / 86400000)
              : null;

            return (
              <div key={g.id} className="bg-card rounded-lg border border-border p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {g.icon && <span className="text-2xl">{g.icon}</span>}
                    <div>
                      <p className="font-semibold text-foreground">{g.name}</p>
                      {g.description && (
                        <p className="text-xs text-muted-foreground">{g.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(g)} className="text-xs px-2 py-1 rounded text-muted-foreground hover:bg-accent transition-colors">
                      Editar
                    </button>
                    <button onClick={() => handleDelete(g.id)} className="text-xs px-2 py-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                      Remover
                    </button>
                  </div>
                </div>

                <ProgressBar value={pct} showLabel className="mb-3" />

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {formatBRL(Number(g.currentAmount))} poupados
                  </span>
                  <span className="text-muted-foreground">
                    meta: {formatBRL(Number(g.targetAmount))}
                  </span>
                </div>

                {daysLeft !== null && (
                  <p className={`mt-2 text-xs ${daysLeft < 0 ? "text-destructive" : daysLeft < 30 ? "text-warning" : "text-muted-foreground"}`}>
                    {daysLeft < 0
                      ? `⚠ Prazo encerrado há ${Math.abs(daysLeft)} dias`
                      : daysLeft === 0
                        ? "🎯 Prazo é hoje!"
                        : `📅 ${daysLeft} dias restantes — ${formatDate(g.targetDate!)}`}
                  </p>
                )}

                {g.isCompleted && (
                  <p className="mt-2 text-xs font-medium text-success">✅ Meta concluída!</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Drawer open={drawerOpen} onClose={closeDrawer} title={editing ? "Editar Meta" : "Nova Meta"}>
        <GoalForm
          goal={editing}
          onSuccess={() => { closeDrawer(); load(); }}
        />
      </Drawer>
    </div>
  );
}

function GoalForm({ goal, onSuccess }: { goal: Goal | null; onSuccess: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState(goal?.name ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [targetCents, setTargetCents] = useState(Math.round(Number(goal?.targetAmount ?? 0) * 100));
  const [currentCents, setCurrentCents] = useState(Math.round(Number(goal?.currentAmount ?? 0) * 100));
  const [targetDate, setTargetDate] = useState(goal?.targetDate?.slice(0, 10) ?? "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || targetCents <= 0) {
      toast({ title: "Informe nome e valor alvo", variant: "error" }); return;
    }
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        targetAmount: targetCents / 100,
        currentAmount: currentCents / 100,
        targetDate: targetDate || undefined,
      };
      if (goal) {
        await api.patch(`/api/goals/${goal.id}`, payload);
        toast({ title: "Meta atualizada!", variant: "success" });
      } else {
        await api.post("/api/goals", payload);
        toast({ title: "Meta criada!", variant: "success" });
      }
      onSuccess();
    } catch {
      toast({ title: "Erro ao salvar meta", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input label="Nome da meta" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Viagem para Europa, Fundo de emergência" autoFocus />
      <Input label="Descrição (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhes sobre a meta..." />
      <CurrencyInput label="Valor alvo" value={targetCents} onChange={setTargetCents} />
      <CurrencyInput label="Valor atual poupado" value={currentCents} onChange={setCurrentCents} />
      <Input label="Prazo (opcional)" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
      <Button type="submit" loading={loading} className="w-full">
        {goal ? "Salvar alterações" : "Criar meta"}
      </Button>
    </form>
  );
}

