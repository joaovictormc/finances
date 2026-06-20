"use client";

import { useState } from "react";
import { PluggyConnect } from "react-pluggy-connect";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { api } from "@/lib/api-client";

export function ConnectBankButton({ onConnected }: { onConnected: () => void }) {
  const { toast } = useToast();
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const startConnect = async () => {
    setLoading(true);
    try {
      const { connectToken } = await api.post<{ connectToken: string }>(
        "/api/pluggy/connect-token",
        {}
      );
      setConnectToken(connectToken);
    } catch {
      toast({ title: "Erro ao iniciar conexão com o banco", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={startConnect} loading={loading}>
        🏦 Conectar Banco
      </Button>

      {connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          includeSandbox={process.env.NODE_ENV !== "production"}
          onSuccess={async (itemData) => {
            setConnectToken(null);
            try {
              await api.post("/api/pluggy/items", { itemId: itemData.item.id });
              toast({ title: "Banco conectado! Sincronizando transações…", variant: "success" });
              onConnected();
            } catch {
              toast({ title: "Conta conectada, mas houve erro ao sincronizar", variant: "error" });
            }
          }}
          onError={() => {
            setConnectToken(null);
            toast({ title: "Não foi possível conectar o banco", variant: "error" });
          }}
          onClose={() => setConnectToken(null)}
        />
      )}
    </>
  );
}
