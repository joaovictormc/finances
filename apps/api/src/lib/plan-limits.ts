import { db } from "@finances/db";
import { getPlan, ADMIN_PLAN, type PlanDefinition } from "./plans";

/** Contas com role "admin" têm acesso completo ao sistema, independente da assinatura. */
export async function getEffectivePlan(userId: string): Promise<PlanDefinition> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role === "admin") return ADMIN_PLAN;

  const subscription = await db.subscription.findUnique({ where: { userId } });
  if (!subscription || subscription.status !== "active") return getPlan("free");
  return getPlan(subscription.plan);
}

export async function getBankConnectionCount(userId: string): Promise<number> {
  return db.financialAccount.count({
    where: {
      userId,
      isArchived: false,
      OR: [{ pluggyItemId: { not: null } }, { openFinanceAccountId: { not: null } }],
    },
  });
}

export async function canAddBankConnection(userId: string): Promise<boolean> {
  const plan = await getEffectivePlan(userId);
  if (plan.maxBankConnections === null) return true;
  const count = await getBankConnectionCount(userId);
  return count < plan.maxBankConnections;
}

export async function isAiInsightsAllowed(userId: string): Promise<boolean> {
  const plan = await getEffectivePlan(userId);
  return plan.aiInsights;
}

export async function isReceiptScanAllowed(userId: string): Promise<boolean> {
  const plan = await getEffectivePlan(userId);
  return plan.receiptScan;
}

export async function isChannelAllowed(userId: string, channel: "telegram" | "whatsapp"): Promise<boolean> {
  const plan = await getEffectivePlan(userId);
  return plan.channels.includes(channel);
}

/** Data mais antiga visível para o usuário, ou null se o plano não tem limite de histórico. */
export async function getHistoryCutoffDate(userId: string): Promise<Date | null> {
  const plan = await getEffectivePlan(userId);
  if (plan.historyMonths === null) return null;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - plan.historyMonths);
  return cutoff;
}

/** Quantos membros (incluindo o owner) o plano do owner do grupo permite. */
export async function canAddGroupMember(groupId: string): Promise<boolean> {
  const group = await db.group.findUnique({ where: { id: groupId }, select: { ownerId: true } });
  if (!group) return false;
  const plan = await getEffectivePlan(group.ownerId);
  const memberCount = await db.groupMember.count({ where: { groupId } });
  return memberCount < plan.maxGroupMembers;
}

// ─────────────────────────────────────────────
// Módulos (free = só básico; pro = básico + integrações; familia = tudo)
// ─────────────────────────────────────────────

export function planHasIntegrationsModule(plan: PlanDefinition): boolean {
  return plan.channels.length > 0 || plan.maxBankConnections !== 0;
}

export function planHasFamilyModule(plan: PlanDefinition): boolean {
  return plan.maxGroupMembers > 1;
}

export async function isIntegrationsModuleAllowed(userId: string): Promise<boolean> {
  return planHasIntegrationsModule(await getEffectivePlan(userId));
}

/** Só quem tem o módulo família pode CRIAR grupos — convidados de qualquer plano podem ser membros. */
export async function isFamilyModuleAllowed(userId: string): Promise<boolean> {
  return planHasFamilyModule(await getEffectivePlan(userId));
}
