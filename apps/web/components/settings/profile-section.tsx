"use client";

import { useEffect, useState } from "react";
import { authClient, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-provider";

export function ProfileSection() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (session?.user?.name) setName(session.user.name);
  }, [session?.user?.name]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSavingProfile(true);
    try {
      await authClient.updateUser({ name: name.trim() });
      toast({ title: "Perfil atualizado!", variant: "success" });
    } catch (err) {
      toast({
        title: "Erro ao atualizar perfil",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <form onSubmit={handleSaveProfile} className="space-y-4">
      <Input
        label="Nome"
        placeholder="Seu nome completo"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Input
        label="Email"
        type="email"
        value={session?.user?.email ?? ""}
        disabled
        title="O email não pode ser alterado por aqui"
      />
      <Button type="submit" size="sm" loading={savingProfile}>Salvar perfil</Button>
    </form>
  );
}
