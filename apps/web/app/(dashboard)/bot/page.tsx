import type { Metadata } from "next";
import { BotIntegrationGate } from "@/components/bot/bot-integration-gate";

export const metadata: Metadata = { title: "Integração Bot" };

export default function BotPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Integração com Bot</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Registre gastos e receitas pelo Telegram ou WhatsApp
        </p>
      </div>

      <BotIntegrationGate />
    </div>
  );
}
