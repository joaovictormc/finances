"use client";

import { useGroups, useSubscription } from "@/lib/queries";
import { useHydrated } from "@/lib/use-hydrated";

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

/** Módulos que dependem de plano, com a rota do módulo e o motivo do bloqueio. */
export type LockedModule = "familia" | "assistente";

const MODULE_ROUTES: Record<LockedModule, string> = { familia: "/groups", assistente: "/assistant" };

/**
 * Destino de um item de menu: o módulo, ou a tela de planos quando ele está
 * bloqueado — com o módulo na URL para a tela explicar qual plano libera.
 * Antes o clique abria o módulo e só mostrava um aviso no rodapé.
 */
export function useModuleLinks() {
  const { hasIntegrations, hasGroupAccess, loading } = usePlanAccess();
  // Enquanto o plano carrega, nada aparece bloqueado (evita piscar o cadeado
  // para quem paga). Nem durante a hidratação: o servidor nunca tem o plano,
  // e o cadeado desenhado ali divergiria do HTML dele.
  const ready = useHydrated() && !loading;
  const locked: Record<LockedModule, boolean> = {
    familia: ready && !hasGroupAccess,
    assistente: ready && !hasIntegrations,
  };
  const moduleFor = (href: string): LockedModule | null =>
    (Object.keys(MODULE_ROUTES) as LockedModule[]).find((m) => MODULE_ROUTES[m] === href) ?? null;

  return {
    isLocked: (href: string) => {
      const m = moduleFor(href);
      return m ? locked[m] : false;
    },
    hrefFor: (href: string) => {
      const m = moduleFor(href);
      return m && locked[m] ? `/settings/billing?recurso=${m}` : href;
    },
  };
}

