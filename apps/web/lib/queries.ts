"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Category, FinancialAccount, Group } from "@/lib/types";

/**
 * Dados de referência que várias telas usam (selects de grupo/categoria/conta,
 * plano, pontos). Ficam no cache do React Query, então trocar de tela não
 * refaz as mesmas chamadas. Quem altera um desses dados invalida a chave
 * correspondente — ver os `invalidateQueries` nas páginas de grupos, contas,
 * cobrança e recompensas.
 */
export const queryKeys = {
  groups: ["groups"] as const,
  /** Prefixo de todas as listas de categoria — invalidar isto atualiza todas. */
  allCategories: ["categories"] as const,
  categories: (type?: "income" | "expense") => ["categories", type ?? "all"] as const,
  accounts: ["accounts"] as const,
  subscription: ["subscription"] as const,
  gamificationProfile: ["gamification-profile"] as const,
};

export function useGroups() {
  return useQuery({
    queryKey: queryKeys.groups,
    queryFn: () => api.get<Group[]>("/api/groups"),
  });
}

export function useCategories(type?: "income" | "expense") {
  return useQuery({
    queryKey: queryKeys.categories(type),
    queryFn: () => api.get<Category[]>("/api/categories", type ? { type } : undefined),
  });
}

/** Contas ativas — para selects. A tela de Contas busca a própria lista (saldo, arquivadas). */
export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: () => api.get<FinancialAccount[]>("/api/accounts"),
  });
}

export type Subscription = {
  plan: "free" | "pro" | "familia";
  hasIntegrationsModule: boolean;
  hasFamilyModule: boolean;
};

export function useSubscription() {
  return useQuery({
    queryKey: queryKeys.subscription,
    queryFn: () => api.get<Subscription>("/api/billing/subscription"),
  });
}

export type GamificationProfile = {
  points: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  spinUnlockStreak: number;
  canSpin: boolean;
  prizes: { label: string; points: number }[];
  checkin: CheckinStatus;
};

export type CheckinStatus = {
  /** Desligado pelo admin: o botão some. */
  enabled: boolean;
  rewardDays: number;
  rewardPoints: number;
  /** Já zerada pela API se o usuário pulou um dia. */
  streak: number;
  checkedInToday: boolean;
};

export function useGamificationProfile() {
  return useQuery({
    queryKey: queryKeys.gamificationProfile,
    queryFn: () => api.get<GamificationProfile>("/api/gamification/profile"),
  });
}
