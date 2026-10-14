"use client";

import { useGroups, useSubscription } from "@/lib/queries";

type PlanAccess = {
  plan: "free" | "pro" | "familia";
  loading: boolean;
  /** Pode usar bot/integrações com banco. */
  hasIntegrations: boolean;
  /** Pode CRIAR um grupo novo (precisa do plano Família). */
  canCreateGroup: boolean;
  /** Já tem algum grupo (próprio ou de convite) — mantém acesso à navegação "Família". */
  hasGroupAccess: boolean;
};

/**
 * Plano e grupos vêm do cache do React Query: as duas sidebars, o NavLinks e
 * as páginas que chamam isto compartilham a mesma busca.
 */
export function usePlanAccess(): PlanAccess {
  const subscription = useSubscription();
  const groups = useGroups();

  const sub = subscription.data;
  const hasFamily = sub?.hasFamilyModule ?? false;

  return {
    plan: sub?.plan ?? "free",
    // Grupos é acessório (falha não bloqueia): só espera a assinatura.
    loading: subscription.isPending,
    hasIntegrations: sub?.hasIntegrationsModule ?? false,
    canCreateGroup: hasFamily,
    hasGroupAccess: hasFamily || (groups.data?.length ?? 0) > 0,
  };
}
