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
      console.log("[pluggy] connectToken obtido");

      const { PluggyConnect } = await import("pluggy-connect-sdk");
      console.log("[pluggy] módulo pluggy-connect-sdk carregado");

      const pluggyConnect = new PluggyConnect({
        connectToken,
        includeSandbox: process.env.NODE_ENV !== "production",
        onSuccess: async (itemData) => {
          console.log("[pluggy] onSuccess", itemData);
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

      console.log("[pluggy] instância criada, chamando init()");
      await pluggyConnect.init();
      console.log("[pluggy] init() concluído com sucesso — widget deve estar visível");
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
