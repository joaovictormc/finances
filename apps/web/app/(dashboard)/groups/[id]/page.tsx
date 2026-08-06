"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Crown, Link2, Trash2, LogOut, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import { useSession } from "@/lib/auth-client";
import { api } from "@/lib/api-client";
import { formatBRL } from "@/lib/utils";
import { SpendingPieChart } from "@/components/overview/spending-pie-chart";
import { MonthlyBarChart } from "@/components/overview/monthly-bar-chart";
import type { GroupDetail } from "@/lib/types";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Membro",
  viewer: "Visualizador",
};

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Membro" },
  { value: "viewer", label: "Visualizador" },
];

type GroupDashboard = {
  income: number;
  expense: number;
  balance: number;
  byCategory: Array<{ category: { id: string; name: string; icon: string | null } | null; total: number }>;
};

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? null;
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [dashboard, setDashboard] = useState<GroupDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [g, d] = await Promise.all([
        api.get<GroupDetail>(`/api/groups/${id}`),
        api.get<GroupDashboard>(`/api/groups/${id}/dashboard`),
      ]);
      setGroup(g);
      setDashboard(d);
    } catch {
      toast({ title: "Erro ao carregar grupo", variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { load(); }, [load]);

  const canManage = group?.role === "owner" || group?.role === "admin";
  const isOwner = group?.role === "owner";

  const handleCopyInvite = async () => {
    try {
      const { inviteLink } = await api.get<{ inviteLink: string }>(`/api/groups/${id}/invite-link`);
      await navigator.clipboard.writeText(inviteLink);
      toast({ title: "Link de convite copiado!", variant: "success" });
    } catch {
      toast({ title: "Erro ao gerar link de convite", variant: "error" });
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!window.confirm("Remover este membro do grupo?")) return;
    try {
      await api.delete(`/api/groups/${id}/members/${userId}`);
      toast({ title: "Membro removido", variant: "success" });
      load();
    } catch {
      toast({ title: "Erro ao remover membro", variant: "error" });
    }
  };

  const handleLeave = async () => {
    if (!currentUserId) return;
    if (!window.confirm("Sair deste grupo?")) return;
    try {
      await api.delete(`/api/groups/${id}/members/${currentUserId}`);
      toast({ title: "Você saiu do grupo", variant: "success" });
      router.push("/groups");
    } catch {
      toast({ title: "Erro ao saír do grupo", variant: "error" });
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm("Excluir este grupo? Os recursos compartilhados voltam a ser pessoais.")) return;
    try {
      await api.delete(`/api/groups/${id}`);
      toast({ title: "Grupo excluído", variant: "success" });
      router.push("/groups");
    } catch {
      toast({ title: "Erro ao excluir grupo", variant: "error" });
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await api.patch(`/api/groups/${id}/members/${userId}`, { role });
      toast({ title: "Papel atualizado", variant: "success" });
      load();
    } catch {
      toast({ title: "Erro ao atualizar papel", variant: "error" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!group) return null;

  const pieData = (dashboard?.byCategory ?? [])
    .filter((row) => row.total > 0)
    .map((row) => ({ name: row.category?.name ?? "Sem categoria", icon: row.category?.icon ?? null, total: row.total }));

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Users size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {group.memberCount} membro{group.memberCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <Button variant="outline" onClick={handleCopyInvite}>
              <Link2 size={14} /> Copiar link de convite
            </Button>
          )}
          {isOwner ? (
            <Button variant="destructive" onClick={handleDeleteGroup}>
              <Trash2 size={14} /> Excluir grupo
            </Button>
          ) : (
            <Button variant="outline" onClick={handleLeave}>
              <LogOut size={14} /> Saír do grupo
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5">
          <p className="text-sm text-muted-foreground mb-1">Receitas (mês)</p>
          <p className="text-xl font-bold text-success">{formatBRL(dashboard?.income ?? 0)}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5">
          <p className="text-sm text-muted-foreground mb-1">Gastos (mês)</p>
          <p className="text-xl font-bold text-destructive">{formatBRL(dashboard?.expense ?? 0)}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5">
          <p className="text-sm text-muted-foreground mb-1">Saldo (mês)</p>
          <p className="text-xl font-bold text-foreground">{formatBRL(dashboard?.balance ?? 0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <h2 className="font-semibold mb-4 text-foreground">Gastos por Categoria</h2>
          <SpendingPieChart data={pieData} totalExpense={dashboard?.expense ?? 0} />
        </div>
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <h2 className="font-semibold mb-4 text-foreground">Receitas vs Gastos</h2>
          <MonthlyBarChart data={[{ label: "Mês atual", income: dashboard?.income ?? 0, expense: dashboard?.expense ?? 0 }]} />
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
        <h2 className="font-semibold mb-4 text-foreground">Membros</h2>
        <div className="space-y-2">
          {group.members.map((m) => (
            <div key={m.userId} className="flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  {m.role === "owner" && <Crown size={13} className="text-highlight" />}
                  {m.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">{m.email}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isOwner && m.role !== "owner" ? (
                  <Select
                    options={ROLE_OPTIONS}
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.userId, e.target.value)}
                    className="h-8 text-xs py-0"
                  />
                ) : (
                  <Badge>{ROLE_LABELS[m.role] ?? m.role}</Badge>
                )}
                {canManage && m.role !== "owner" && (
                  <button
                    onClick={() => handleRemoveMember(m.userId)}
                    className="text-xs px-2 py-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
