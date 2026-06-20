"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { CategoryIcon } from "@/components/ui/category-icon";
import { useToast } from "@/components/ui/toast-provider";
import { api } from "@/lib/api-client";
import { ConnectBankButton } from "@/components/accounts/connect-bank-button";
import type { FinancialAccount, Group } from "@/lib/types";

const accountTypeLabels: Record<string, string> = {
  checking: "Conta Corrente",
  savings: "Poupança",
  credit_card: "Cartão de Crédito",
  investment: "Investimento",
  wallet: "Carteira",
};

const accountTypeIcons: Record<string, string> = {
  checking: "🏦",
  savings: "🐷",
  credit_card: "💳",
  investment: "📈",
  wallet: "👛",
};

export default function AccountsPage() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialAccount | null>(null);
  const [formKey, setFormKey] = useState(0);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [data, grps] = await Promise.all([
        api.get<FinancialAccount[]>("/api/accounts"),
        api.get<Group[]>("/api/groups"),
      ]);
      setAccounts(data);
      setGroups(grps);
    } catch {
      toast({ title: "Erro ao carregar contas", variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setFormKey((k) => k + 1); setDrawerOpen(true); };
  const openEdit = (a: FinancialAccount) => { setEditing(a); setFormKey((k) => k + 1); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setEditing(null); };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Arquivar esta conta?")) return;
    try {
      await api.delete(`/api/accounts/${id}`);
      toast({ title: "Conta arquivada", variant: "success" });
      load();
    } catch {
      toast({ title: "Erro ao arquivar conta", variant: "error" });
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contas Bancárias</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie suas contas e cartões</p>
        </div>
        <div className="flex gap-2">
          <ConnectBankButton onConnected={load} />
          <Button onClick={openNew}>+ Nova Conta</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm">
          <EmptyState
            icon={CreditCard}
            title="Nenhuma conta cadastrada"
            description="Adicione suas contas bancárias, cartões e carteiras digitais"
            action={{ label: "+ Nova Conta", onClick: openNew }}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a) => (
            <div key={a.id} className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <CategoryIcon icon={accountTypeIcons[a.type] ?? "🏦"} color={a.color} />
                  <div>
                    <p className="font-semibold text-foreground">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {accountTypeLabels[a.type] ?? a.type}
                      {a.institution && ` · ${a.institution}`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(a)}
                    className="text-xs px-2 py-1 rounded text-muted-foreground hover:bg-accent transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="text-xs px-2 py-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    Arquivar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Drawer open={drawerOpen} onClose={closeDrawer} title={editing ? "Editar Conta" : "Nova Conta"}>
        <AccountForm
          key={formKey}
          account={editing}
          groups={groups}
          onSuccess={() => { closeDrawer(); load(); }}
        />
      </Drawer>
    </div>
  );
}

function AccountForm({
  account,
  groups,
  onSuccess,
}: {
  account: FinancialAccount | null;
  groups: Group[];
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState(account?.type ?? "checking");
  const [institution, setInstitution] = useState(account?.institution ?? "");
  const [groupId, setGroupId] = useState(account?.groupId ?? "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast({ title: "Informe o nome da conta", variant: "error" }); return; }
    setLoading(true);
    try {
      const payload = { name: name.trim(), type, institution: institution.trim() || undefined, groupId: groupId || undefined };
      if (account) {
        await api.patch(`/api/accounts/${account.id}`, payload);
        toast({ title: "Conta atualizada!", variant: "success" });
      } else {
        await api.post("/api/accounts", payload);
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
      <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Nubank, Itaú Corrente" autoFocus />
      <Select
        label="Tipo"
        value={type}
        onChange={(e) => setType(e.target.value)}
        options={Object.entries(accountTypeLabels).map(([v, l]) => ({ value: v, label: l }))}
      />
      <Input label="Instituição (opcional)" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Ex: Nubank, Itaú, Bradesco" />
      <Select
        label="Compartilhar com"
        value={groupId}
        onChange={(e) => setGroupId(e.target.value)}
        options={[{ value: "", label: "Pessoal" }, ...groups.map((g) => ({ value: g.id, label: g.name }))]}
      />
      <Button type="submit" loading={loading} className="w-full">
        {account ? "Salvar alterações" : "Criar conta"}
      </Button>
    </form>
  );
}

