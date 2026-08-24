"use client";

import { useCallback, useEffect, useState } from "react";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "user" | "support" | "admin";
  createdAt: string;
  subscription: { plan: "free" | "pro" | "familia"; status: string; currentPeriodEnd: string | null } | null;
};

const ROLE_LABELS: Record<string, string> = { user: "Usuário", support: "Suporte", admin: "Admin" };
const PLAN_LABELS: Record<string, string> = { free: "Free", pro: "Pro", familia: "Família" };
const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
  active: "success",
  past_due: "warning",
  canceled: "destructive",
};

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [planTarget, setPlanTarget] = useState<AdminUser | null>(null);

  const load = useCallback(async (q?: string) => {
    setIsLoading(true);
    try {
      const data = await api.get<{ users: AdminUser[] }>("/api/admin/users", q ? { q } : undefined);
      setUsers(data.users);
    } catch {
      toast({ title: "Erro ao carregar usuários", variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function handleRoleChange(user: AdminUser, role: string) {
    try {
      await api.patch(`/api/admin/users/${user.id}/role`, { role });
      toast({ title: "Role atualizado", variant: "success" });
      load(query || undefined);
    } catch {
      toast({ title: "Erro ao atualizar role", variant: "error" });
    }
  }

  async function handleCancelSubscription(user: AdminUser) {
    if (!confirm(`Cancelar a assinatura de ${user.name}?`)) return;
    try {
      await api.post(`/api/admin/users/${user.id}/subscription/cancel`, {});
      toast({ title: "Assinatura cancelada", variant: "success" });
      load(query || undefined);
    } catch {
      toast({ title: "Erro ao cancelar assinatura", variant: "error" });
    }
  }

  return (
    <div>
      <BackButton href="/admin" label="Administração" />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Usuários e Planos</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie roles, planos e assinaturas dos usuários</p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); load(query || undefined); }}
        className="mb-4 flex gap-2 max-w-sm"
      >
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome ou email" />
        <Button type="submit" variant="outline">Buscar</Button>
      </form>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : users.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm">
          <EmptyState icon={Users} title="Nenhum usuário encontrado" />
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                <th className="p-3">Nome</th>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3">Plano</th>
                <th className="p-3">Status</th>
                <th className="p-3">Desde</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border/40 last:border-0">
                  <td className="p-3 font-medium text-foreground">{u.name}</td>
                  <td className="p-3 text-muted-foreground">{u.email}</td>
                  <td className="p-3">
                    <Select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u, e.target.value)}
                      options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))}
                      className="h-8 py-0 text-xs"
                    />
                  </td>
                  <td className="p-3">{PLAN_LABELS[u.subscription?.plan ?? "free"]}</td>
                  <td className="p-3">
                    {u.subscription ? (
                      <Badge variant={STATUS_VARIANT[u.subscription.status] ?? "default"}>
                        {u.subscription.status}
                      </Badge>
                    ) : (
                      <Badge>sem assinatura</Badge>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">{formatDate(u.createdAt)}</td>
                  <td className="p-3">
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => setPlanTarget(u)}>
                        Alterar plano
                      </Button>
                      {u.subscription?.status === "active" && (
                        <Button size="sm" variant="destructive" onClick={() => handleCancelSubscription(u)}>
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer open={!!planTarget} onClose={() => setPlanTarget(null)} title="Alterar plano">
        {planTarget && (
          <ChangePlanForm
            user={planTarget}
            onSuccess={() => { setPlanTarget(null); load(query || undefined); }}
          />
        )}
      </Drawer>
    </div>
  );
}

function ChangePlanForm({ user, onSuccess }: { user: AdminUser; onSuccess: () => void }) {
  const { toast } = useToast();
  const [plan, setPlan] = useState(user.subscription?.plan ?? "free");
  const [status, setStatus] = useState(user.subscription?.status ?? "active");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.patch(`/api/admin/users/${user.id}/plan`, { plan, status });
      toast({ title: "Plano atualizado", variant: "success" });
      onSuccess();
    } catch {
      toast({ title: "Erro ao atualizar plano", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm text-muted-foreground">{user.name} ({user.email})</p>
      <Select
        label="Plano"
        value={plan}
        onChange={(e) => setPlan(e.target.value as typeof plan)}
        options={Object.entries(PLAN_LABELS).map(([value, label]) => ({ value, label }))}
      />
      <Select
        label="Status"
        value={status}
        onChange={(e) => setStatus(e.target.value as typeof status)}
        options={[
          { value: "active", label: "Ativo" },
          { value: "past_due", label: "Pagamento pendente" },
          { value: "canceled", label: "Cancelado" },
        ]}
      />
      <Button type="submit" loading={loading} className="w-full">Salvar</Button>
    </form>
  );
}
