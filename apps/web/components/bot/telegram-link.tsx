"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";

type Status = { linked: boolean; telegramChatId: string | null };

export function TelegramLink() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState(false);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const s = await api.get<Status>("/api/bots/telegram/status");
      setLinked(s.linked);
    } catch {
      // sem sessão / erro de rede → mostra o formulário de vinculação
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setSubmitting(true);
    try {
      await api.post("/api/bots/telegram/link", { code: code.trim() });
      setLinked(true);
      setCode("");
      toast({
        title: "Telegram vinculado!",
        description: "Agora você pode registrar gastos pelo bot.",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Não foi possível vincular",
        description: (err as Error).message,
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnlink() {
    setUnlinking(true);
    try {
      await api.delete("/api/bots/telegram/link");
      setLinked(false);
      toast({ title: "Telegram desvinculado", variant: "success" });
    } catch (err) {
      toast({
        title: "Erro ao desvincular",
        description: (err as Error).message,
        variant: "error",
      });
    } finally {
      setUnlinking(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Verificando vinculação...
      </div>
    );
  }

  if (linked) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-md bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" />
          <span className="font-medium">Telegram vinculado</span>
        </div>
        <Button variant="outline" size="sm" loading={unlinking} onClick={handleUnlink}>
          Desvincular
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleLink} className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Cole o código do Telegram aqui"
          maxLength={12}
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <Button type="submit" loading={submitting}>
          Vincular
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        1. Abra o Telegram e busque nosso bot
        <br />
        2. Envie /start
        <br />
        3. Cole o código de 6 dígitos acima
      </p>
    </form>
  );
}
