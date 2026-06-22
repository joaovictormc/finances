export type PlanId = "free" | "pro" | "familia";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  priceCents: number; // em centavos (BRL)
  maxBankConnections: number | null; // null = ilimitado
  historyMonths: number | null; // null = ilimitado
  channels: Array<"telegram" | "whatsapp">;
  aiInsights: boolean;
  maxGroupMembers: number; // 1 = sem grupo
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    priceCents: 0,
    maxBankConnections: 0, // sem módulo de integrações: só contas manuais
    historyMonths: 3,
    channels: [], // sem módulo de integrações: sem bot
    aiInsights: false,
    maxGroupMembers: 1, // sem módulo família
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceCents: 1990,
    maxBankConnections: null,
    historyMonths: null,
    channels: ["telegram", "whatsapp"],
    aiInsights: true,
    maxGroupMembers: 1, // sem módulo família — só Família libera grupos
  },
  familia: {
    id: "familia",
    name: "Família",
    priceCents: 2990,
    maxBankConnections: null,
    historyMonths: null,
    channels: ["telegram", "whatsapp"],
    aiInsights: true,
    maxGroupMembers: 5,
  },
};

export function getPlan(planId: string): PlanDefinition {
  return PLANS[planId as PlanId] ?? PLANS.free;
}

/** Acesso total — usado para contas com role "admin", independente da assinatura. */
export const ADMIN_PLAN: PlanDefinition = {
  id: "familia",
  name: "Admin (acesso total)",
  priceCents: 0,
  maxBankConnections: null,
  historyMonths: null,
  channels: ["telegram", "whatsapp"],
  aiInsights: true,
  maxGroupMembers: Number.MAX_SAFE_INTEGER,
};
