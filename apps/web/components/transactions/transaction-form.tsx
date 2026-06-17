"use client";

import { useEffect, useState } from "react";
import { CurrencyInput, parseBRL } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast-provider";
import type { Category, FinancialAccount, Transaction } from "@/lib/types";

type TransactionType = "expense" | "income" | "transfer";

interface TransactionFormProps {
  transaction?: Transaction | null;
  categories: Category[];
  accounts: FinancialAccount[];
  onSuccess: () => void;
}

const tabs: { value: TransactionType; label: string; activeClass: string }[] = [
  { value: "expense", label: "Gasto", activeClass: "bg-destructive text-white" },
  { value: "income", label: "Receita", activeClass: "bg-success text-white" },
  { value: "transfer", label: "Transferência", activeClass: "bg-primary text-primary-foreground" },
];

function flattenCategories(cats: Category[], type: string): Category[] {
  const result: Category[] = [];
  for (const c of cats) {
    if (c.type === type || c.type === "transfer") {
      result.push(c);
      if (c.children?.length) result.push(...flattenCategories(c.children, type));
    }
  }
  return result;
}

export function TransactionForm({ transaction, categories, accounts, onSuccess }: TransactionFormProps) {
  const { toast } = useToast();
  const [type, setType] = useState<TransactionType>(transaction?.type ?? "expense");
  const [amountCents, setAmountCents] = useState(Math.round(Number(transaction?.amount ?? 0) * 100));
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [accountId, setAccountId] = useState(transaction?.account?.id ?? "");
  const [categoryId, setCategoryId] = useState(transaction?.category?.id ?? "");
  const [date, setDate] = useState(
    transaction?.date ? transaction.date.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState(transaction?.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setCategoryId("");
  }, [type]);

  const filteredCategories = flattenCategories(categories, type);

  const validate = () => {
    const e: Record<string, string> = {};
    if (amountCents <= 0) e.amount = "Informe o valor";
    if (!description.trim()) e.description = "Informe a descrição";
    if (!accountId) e.accountId = "Selecione uma conta";
    if (!date) e.date = "Informe a data";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = {
        type,
        amount: amountCents / 100,
        description: description.trim(),
        accountId,
        categoryId: categoryId || undefined,
        date,
        notes: notes.trim() || undefined,
      };
      if (transaction) {
        await api.patch(`/api/transactions/${transaction.id}`, payload);
        toast({ title: "Transação atualizada!", variant: "success" });
      } else {
        await api.post("/api/transactions", payload);
        toast({ title: "Transação criada!", variant: "success" });
      }
      onSuccess();
    } catch (err) {
      toast({ title: "Erro ao salvar transação", description: String(err), variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Type tabs */}
      <div className="flex gap-1.5 rounded-lg bg-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setType(tab.value)}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              type === tab.value
                ? tab.activeClass
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <CurrencyInput
        label="Valor"
        value={amountCents}
        onChange={setAmountCents}
        error={errors.amount}
      />

      <Input
        label="Descrição"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Ex: Mercado Extra"
        error={errors.description}
        autoFocus
      />

      <Select
        label="Conta"
        value={accountId}
        onChange={(e) => setAccountId(e.target.value)}
        placeholder="Selecione uma conta"
        options={accounts.map((a) => ({ value: a.id, label: a.name }))}
        error={errors.accountId}
      />

      <Select
        label="Categoria"
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        placeholder="Sem categoria"
        options={filteredCategories.map((c) => ({
          value: c.id,
          label: `${c.icon ?? ""} ${c.name}`.trim(),
        }))}
      />

      <Input
        label="Data"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        error={errors.date}
      />

      <Input
        label="Observações (opcional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Detalhes adicionais..."
      />

      <Button type="submit" loading={loading} className="w-full">
        {transaction ? "Salvar alterações" : "Criar transação"}
      </Button>
    </form>
  );
}
