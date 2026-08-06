"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Drawer } from "@/components/ui/drawer";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { CategoryIcon } from "@/components/ui/category-icon";
import { useToast } from "@/components/ui/toast-provider";
import { api } from "@/lib/api-client";
import { ConnectBankButton } from "@/components/accounts/connect-bank-button";
import { ImportForm } from "@/components/transactions/import-form";
import type { FinancialAccount, Group } from "@/lib/types";

const PLUGGY_ENABLED = process.env.NEXT_PUBLIC_ENABLE_PLUGGY === "true";

function formatLastSync(lastSyncedAt: string | null | undefined): {
  label: string;
  tone: "neutral" | "warning" | "danger";
} {
  if (!lastSyncedAt) return { label: "Nunca atualizado", tone: "neutral" };
  const days = Math.floor((Date.now() - new Date(lastSyncedAt).getTime()) / (1000 * 60 * 60 * 24));
  const label = `Atualizado há ${days} dia${days === 1 ? "" : "s"}`;
  if (days >= 30) return { label, tone: "danger" };
  if (days >= 15) return { label, tone: "warning" };
  return { label, tone: "neutral" };
}

const toneStyles: Record<"neutral" | "warning" | "danger", string> = {
  neutral: "bg-muted/50 text-muted-foreground",
  warning: "bg-amber-500/10 text-amber-600",
  danger: "bg-red-500/10 text-red-600",
};

const toneIcon: Record<"neutral" | "warning" | "danger", string> = {
  neutral: "",
  warning: "⚠ ",
  danger: "🔴 ",
};

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
  const [importingAccount, setImportingAccount] = useState<FinancialAccount | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [data, grps] = await Promise.all([
        api.get<FinancialAccount[]>("/api/accounts", { archived: showArchived }),
        api.get<Group[]>("/api/groups"),
      ]);
      setAccounts(data);
      setGroups(grps);
    } catch {
      toast({ title: "Erro ao carregar contas", variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, showArchived]);

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

  const handlePermanentDelete = async (a: FinancialAccount) => {
    const txCount = a._count?.transactions ?? 0;
    const message =
      txCount > 0
        ? `Excluir definitivamente "${a.name}"? Isso vai apagar a conta e ${txCount} transação${txCount === 1 ? "" : "ões"} vinculada${txCount === 1 ? "" : "s"}. Essa ação não pode ser desfeita.`
        : `Excluir definitivamente "${a.name}"? Essa ação não pode ser desfeita.`;
    if (!window.confirm(message)) return;
    try {
      await api.delete(`/api/accounts/${a.id}/permanent`);
      toast({ title: "Conta excluída definitivamente", variant: "success" });
      load();
    } catch {
      toast({ title: "Erro ao excluir conta", variant: "error" });
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
          {PLUGGY_ENABLED && <ConnectBankButton onConnected={load} />}
          <Button onClick={openNew}>+ Nova Conta</Button>
        </div>
      </div>

      <div className="mb-4 flex gap-1 rounded-lg bg-muted p-1 w-fit">
        <button
          onClick={() => setShowArchived(false)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            !showArchived ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Ativas
        </button>
        <button
          onClick={() => setShowArchived(true)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            showArchived ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Arquivadas
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm">
          <EmptyState
            icon={CreditCard}
            title={showArchived ? "Nenhuma conta arquivada" : "Nenhuma conta cadastrada"}
            description={
              showArchived
                ? "Contas arquivadas aparecem aqui para exclusão definitiva"
                : "Adicione suas contas bancárias, cartões e carteiras digitais"
            }
            action={showArchived ? undefined : { label: "+ Nova Conta", onClick: openNew }}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a) => {
            const sync = formatLastSync(a.lastSyncedAt);
            return (
              <div key={a.id} className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden transition-shadow hover:shadow-md">
                <div className="p-5">
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
                      {showArchived ? (
                        <button
                          onClick={() => handlePermanentDelete(a)}
                          className="text-xs px-2 py-1 rounded text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          Excluir definitivamente
                        </button>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {!showArchived && (
                  <div className={`flex items-center justify-between px-5 py-2 text-xs ${toneStyles[sync.tone]}`}>
                    <span>{toneIcon[sync.tone]}{sync.label}</span>
                    <button
                      onClick={() => setImportingAccount(a)}
                      className="font-medium hover:underline"
                    >
                      📄 Importar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={drawerOpen} onClose={closeDrawer} title={editing ? "Editar Conta" : "Nova Conta"}>
        <AccountForm
          key={formKey}
          account={editing}
          groups={groups}
          onSuccess={() => { closeDrawer(); load(); }}
        />
      </Modal>

      <Drawer
        open={importingAccount !== null}
        onClose={() => setImportingAccount(null)}
        title={`Importar extrato — ${importingAccount?.name ?? ""}`}
      >
        {importingAccount && (
          <ImportForm
            accounts={accounts}
            fixedAccountId={importingAccount.id}
            onSuccess={() => { setImportingAccount(null); load(); }}
          />
        )}
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
  const [hasCreditCard, setHasCreditCard] = useState(account?.hasCreditCard ?? false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast({ title: "Informe o nome da conta", variant: "error" }); return; }
    setLoading(true);
    try {
      const payload = { name: name.trim(), type, institution: institution.trim() || undefined, groupId: groupId || undefined, hasCreditCard };
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
      <div className="flex items-start gap-4 py-2">
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Tem cartão de crédito vinculado</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Permite importar a fatura do cartão separada do extrato, na mesma conta.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setHasCreditCard((v) => !v)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            hasCreditCard ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
              hasCreditCard ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      <Button type="submit" loading={loading} className="w-full">
        {account ? "Salvar alterações" : "Criar conta"}
      </Button>
    </form>
  );
}

