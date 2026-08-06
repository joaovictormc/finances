"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { TelegramLink } from "@/components/bot/telegram-link";
import { usePlanAccess } from "@/lib/use-plan-access";

export function BotIntegrationGate() {
  const { hasIntegrations, loading } = usePlanAccess();

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!hasIntegrations) {
    return (
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Lock size={20} />
        </div>
        <h2 className="font-semibold mb-1">Disponível nos planos Pro e Família</h2>
        <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
          Registre gastos e receitas pelo Telegram ou WhatsApp fazendo upgrade do seu plano.
        </p>
        <Link
          href="/settings/billing"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Ver planos
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white font-bold shadow-sm">
            ✈️
          </div>
          <div>
            <h2 className="font-semibold">Telegram</h2>
            <p className="text-xs text-muted-foreground">Disponível agora</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Envie mensagens de texto ou áudio para o bot e ele registrará automaticamente
          seus gastos e receitas usando IA.
        </p>

        <div className="bg-muted rounded-md p-3 mb-4">
          <p className="text-xs font-mono">
            Exemplos:<br />
            "gastei 50 no mercado"<br />
            "recebi salário de 3200"<br />
            "uber 23 conto"
          </p>
        </div>

        <TelegramLink />
      </div>

      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 opacity-70">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center text-white font-bold shadow-sm">
            💬
          </div>
          <div>
            <h2 className="font-semibold">WhatsApp</h2>
            <p className="text-xs text-muted-foreground">Em breve</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Integração com WhatsApp Business API. Mesma experiência do Telegram,
          com suporte a mensagens de voz e botões interativos.
        </p>

        <button
          disabled
          className="w-full rounded-md bg-muted text-muted-foreground py-2 text-sm font-medium cursor-not-allowed"
        >
          Disponível em breve
        </button>
      </div>
    </div>
  );
}
