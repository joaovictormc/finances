"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Users, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { usePlanAccess } from "@/lib/use-plan-access";
import type { Group } from "@/lib/types";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Membro",
  viewer: "Visualizador",
};

export default function GroupsPage() {
  const { toast } = useToast();
  const { canCreateGroup } = usePlanAccess();
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get<Group[]>("/api/groups");
      setGroups(data);
    } catch {
      toast({ title: "Erro ao carregar grupos", variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Família/Grupo</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Compartilhe contas, orçamentos e metas com outras pessoas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setJoinOpen(true)}>Entrar com link</Button>
          {canCreateGroup ? (
            <Button onClick={() => setCreateOpen(true)}>+ Criar grupo</Button>
          ) : (
            <Link href="/settings/billing">
              <Button variant="outline" title="Disponível no plano Família">Criar grupo (Família)</Button>
            </Link>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm">
          <EmptyState
            icon={Users}
            title="Nenhum grupo ainda"
            description={
              canCreateGroup
                ? "Crie um grupo para compartilhar finanças com sua família ou entre usando um link de convite"
                : "Criar um grupo é exclusivo do plano Família. Você ainda pode entrar em um grupo com um link de convite."
            }
            action={
              canCreateGroup
                ? { label: "+ Criar grupo", onClick: () => setCreateOpen(true) }
                : { label: "Ver planos", onClick: () => { window.location.href = "/settings/billing"; } }
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/groups/${g.id}`}
              className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Users size={18} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{g.name}</p>
                  <p className="text-xs text-muted-foreground">{g.memberCount} membro{g.memberCount !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {g.role === "owner" && <Crown size={12} className="text-highlight" />}
                <span>{ROLE_LABELS[g.role] ?? g.role}</span>
                <span className="mx-1">·</span>
                <span>desde {formatDate(g.createdAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Drawer open={createOpen} onClose={() => setCreateOpen(false)} title="Criar grupo">
        <CreateGroupForm onSuccess={() => { setCreateOpen(false); load(); }} />
      </Drawer>

      <Drawer open={joinOpen} onClose={() => setJoinOpen(false)} title="Entrar em um grupo">
        <JoinGroupForm onSuccess={() => { setJoinOpen(false); load(); }} />
      </Drawer>
    </div>
  );
}

function CreateGroupForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Informe um nome para o grupo", variant: "error" });
      return;
    }
    setLoading(true);
    try {
      await api.post("/api/groups", { name: name.trim() });
      toast({ title: "Grupo criado!", variant: "success" });
      onSuccess();
    } catch {
      toast({ title: "Erro ao criar grupo", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        label="Nome do grupo"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ex: Família Silva, Apartamento 302"
        autoFocus
      />
      <Button type="submit" loading={loading} className="w-full">Criar grupo</Button>
    </form>
  );
}

function JoinGroupForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);

  const extractCode = (value: string) => {
    const trimmed = value.trim();
    const parts = trimmed.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? trimmed;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = extractCode(link);
    if (!code) {
      toast({ title: "Cole o link de convite", variant: "error" });
      return;
    }
    setLoading(true);
    try {
      await api.post(`/api/groups/join/${code}`, {});
      toast({ title: "Você entrou no grupo!", variant: "success" });
      onSuccess();
    } catch {
      toast({ title: "Link de convite inválido", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        label="Link ou código de convite"
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="Cole aqui o link de convite"
        autoFocus
      />
      <Button type="submit" loading={loading} className="w-full">Entrar no grupo</Button>
    </form>
  );
}
