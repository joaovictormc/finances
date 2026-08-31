"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { api } from "@/lib/api-client";

export function ConnectBankButton({ onConnected }: { onConnected: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const startConnect = async () => {
    setLoading(true);
    try {
      const { connectToken } = await api.post<{ connectToken: string }>(
        "/api/pluggy/connect-token",
        {}
      );

      const { PluggyConnect } = await import("pluggy-connect-sdk");

      const pluggyConnect = new PluggyConnect({
        connectToken,
        includeSandbox: process.env.NODE_ENV !== "production",
        onSuccess: async (itemData) => {
          try {
            await api.post("/api/pluggy/items", { itemId: itemData.item.id });
            toast({ title: "Banco conectado! Sincronizando transações…", variant: "success" });
            onConnected();
          } catch {
            toast({ title: "Conta conectada, mas houve erro ao sincronizar", variant: "error" });
          }
        },
        onError: (error) => {
          console.error("[pluggy] onError", error);
          toast({ title: "Não foi possível conectar o banco", variant: "error" });
        },
      });

      await pluggyConnect.init();
    } catch (err) {
      console.error("[pluggy] falha ao iniciar widget:", err);
      toast({ title: (err as Error).message || "Erro ao iniciar conexão com o banco", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" onClick={startConnect} loading={loading}>
      🏦 Conectar Banco
    </Button>
  );
}
