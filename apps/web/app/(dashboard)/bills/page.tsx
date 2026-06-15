"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Drawer } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import { api } from "@/lib/api-client";
import { formatBRL, formatDate } from "@/lib/utils";
import type { RecurringBill } from "@/lib/types";

const frequencyLabels: Record<string, string> = {
  monthly: "Mensal",
  weekly: "Semanal",
  annual: "Anual",
  custom: "Personalizado",
};

export default function BillsPage() {
  const { toast } = useToast();
  const [bills, setBills] = useState<RecurringBill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringBill | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get<RecurringBill[]>("/api/bills");
      setBills(data);
    } catch {
      toast({ title: "Erro ao carregar contas", variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setDrawerOpen(true); };
  const openEdit = (b: RecurringBill) => { setEditing(b); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setEditing(null); };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Remover esta conta recorrente?")) return;
    try {
      await api.delete(`/api/bills/${id}`);
      toast({ title: "Conta removida", variant: "success" });
      load();
    } catch {
      toast({ title: "Erro ao remover conta", variant: "error" });
    }
  };

  const getDueBadge = (bill: RecurringBill) => {
    if (!bill.nextDueDate) return null;
    const days = Math.ceil((new Date(bill.nextDueDate).getTime() - Date.now()) / 86400000);
    if (days < 0) return <Badge variant="destructive">Vencida</Badge>;
    if (days <= 3) return <Badge variant="warning">Vence em {days}d</Badge>;
    if (days <= 7) return <Badge variant="default">Em {days} dias</Badge>;
    return null;
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contas a Pagar</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie suas contas e despesas recorrentes</p>
        </div>
        <Button onClick={openNew}>+ Nova Conta</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : bills.length === 0 ? (
        <div className="bg-card rounded-lg border border-border">
          <EmptyState
            icon={FileText}
            title="Nenhuma conta recorrente"
            description="Adicione seus boletos, assinaturas e despesas fixas para não perder os vencimentos"
            action={{ label: "+ Nova Conta", onClick: openNew }}
          />
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          {bills.map((b, i) => (
            <div key={b.id} className={`flex items-center gap-4 px-5 py-4 ${i < bills.length - 1 ? "border-b border-border" : ""}`}>
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-lg shrink-0">
                {b.category?.icon ?? "📄"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-foreground">{b.name}</p>
                  {getDueBadge(b)}
                  {!b.isActive && <Badge variant="default">Inativa</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {frequencyLabels[b.frequency] ?? b.frequency}
                  {b.dayOfMonth && ` · Todo dia ${b.dayOfMonth}`}
                  {b.nextDueDate && ` · Próximo: ${formatDate(b.nextDueDate)}`}
                </p>
              </div>
              <div className="text-right shrink-0">
                {b.expectedAmount ? (
                  <p className="font-semibold text-foreground">{formatBRL(Number(b.expectedAmount))}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Valor variável</p>
                )}
                <div className="flex gap-1 justify-end mt-1">
                  <button onClick={() => openEdit(b)} className="text-xs px-2 py-1 rounded text-muted-foreground hover:bg-accent transition-colors">
                    Editar
                  </button>
                  <button onClick={() => handleDelete(b.id)} className="text-xs px-2 py-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    Remover
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Drawer open={drawerOpen} onClose={closeDrawer} title={editing ? "Editar Conta" : "Nova Conta Recorrente"}>
        <BillForm
          bill={editing}
          onSuccess={() => { closeDrawer(); load(); }}
        />
      </Drawer>
    </div>
  );
}

function BillForm({ bill, onSuccess }: { bill: RecurringBill | null; onSuccess: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState(bill?.name ?? "");
  const [amountCents, setAmountCents] = useState(Math.round(Number(bill?.expectedAmount ?? 0) * 100));
  const [frequency, setFrequency] = useState(bill?.frequency ?? "monthly");
  const [dayOfMonth, setDayOfMonth] = useState(String(bill?.dayOfMonth ?? ""));
  const [nextDueDate, setNextDueDate] = useState(bill?.nextDueDate?.slice(0, 10) ?? "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast({ title: "Informe o nome", variant: "error" }); return; }
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        expectedAmount: amountCents > 0 ? amountCents / 100 : undefined,
        frequency,
        dayOfMonth: dayOfMonth ? parseInt(dayOfMonth) : undefined,
        nextDueDate: nextDueDate || undefined,
      };
      if (bill) {
        await api.patch(`/api/bills/${bill.id}`, payload);
        toast({ title: "Conta atualizada!", variant: "success" });
      } else {
        await api.post("/api/bills", payload);
        toast({ title: "Conta criada!", variant: "success" });
      }
      onSuccess();
    } catch {
      toast({ title: "Erro ao salvar conta", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Netflix, Aluguel, Internet" autoFocus />
      <CurrencyInput label="Valor esperado (opcional)" value={amountCents} onChange={setAmountCents} />
      <Select
        label="Frequência"
        value={frequency}
        onChange={(e) => setFrequency(e.target.value)}
        options={Object.entries(frequencyLabels).map(([v, l]) => ({ value: v, label: l }))}
      />
      {frequency === "monthly" && (
        <Input
          label="Dia do mês"
          type="number"
          min={1}
          max={31}
          value={dayOfMonth}
          onChange={(e) => setDayOfMonth(e.target.value)}
          placeholder="Ex: 10"
        />
      )}
      <Input label="Próximo vencimento (opcional)" type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
      <Button type="submit" loading={loading} className="w-full">
        {bill ? "Salvar alterações" : "Criar conta recorrente"}
      </Button>
    </form>
  );
}

