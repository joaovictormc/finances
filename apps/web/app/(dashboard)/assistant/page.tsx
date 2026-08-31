"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import { usePlanAccess } from "@/lib/use-plan-access";

export default function AssistantPage() {
  const { hasIntegrations, loading } = usePlanAccess();

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Assistente</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Tire dúvidas sobre suas finanças, planeje orçamentos e trace metas — com base nos seus
          dados reais
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : hasIntegrations ? (
        <AssistantChat />
      ) : (
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Lock size={20} />
          </div>
          <h2 className="font-semibold mb-1">Disponível nos planos Pro e Família</h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
            O assistente consulta seus gastos, orçamentos e contas para responder perguntas e
            ajudar no planejamento. Você também pode criar agentes com foco em assuntos
            específicos.
          </p>
          <Link
            href="/settings/billing"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Ver planos
          </Link>
        </div>
      )}
    </div>
  );
}
