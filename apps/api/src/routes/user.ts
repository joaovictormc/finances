import { Hono } from "hono";
import { db } from "@finances/db";
import { requireAuth, type AuthVariables } from "../middleware/auth";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth);

// Teto de segurança pras listas potencialmente grandes do export (não é
// paginação de verdade — é só pra evitar que uma conta muito antiga carregue
// dezenas de milhares de linhas em memória numa única resposta síncrona).
// Cobre décadas de uso real; se algum dia precisar exportar mais que isso,
// vale trocar por um job assíncrono em vez de aumentar o número.
const EXPORT_LIST_LIMIT = 5000;

// Roda um objeto de promises em paralelo preservando as chaves — evita o
// desalinhamento silencioso de um Promise.all posicional (uma reordenação
// futura não some com o nome do campo).
async function parallel<T extends Record<string, Promise<unknown>>>(
  promises: T
): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
  const entries = Object.entries(promises);
  const results = await Promise.all(entries.map(([, p]) => p));
  return Object.fromEntries(entries.map(([key], i) => [key, results[i]])) as {
    [K in keyof T]: Awaited<T[K]>;
  };
}

// Exporta todos os dados pessoais do usuário em JSON (LGPD, art. 18, IV/V).
// Credenciais ficam de fora: senha, contas OAuth, segredos de 2FA e os tokens
// de sessão e de push (incluí-los vazaria acessos ativos). Das sessões e dos
// aparelhos sai só o que é dado pessoal — IP, navegador, aparelho e datas.
// Tokens do Open Finance também saem redigidos pelo mesmo motivo.
app.get("/export", async (c) => {
  const userId = c.get("userId");

  const data = await parallel({
    user: db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, emailVerified: true, role: true, createdAt: true, updatedAt: true },
    }),
    profile: db.userProfile.findUnique({ where: { userId } }),
    financialAccounts: db.financialAccount.findMany({ where: { userId } }),
    transactions: db.transaction.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: EXPORT_LIST_LIMIT,
    }),
    categories: db.category.findMany({ where: { userId } }),
    budgets: db.budget.findMany({ where: { userId } }),
    goals: db.goal.findMany({ where: { userId } }),
    recurringBills: db.recurringBill.findMany({ where: { userId } }),
    notifications: db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: EXPORT_LIST_LIMIT,
    }),
    aiInsights: db.aiInsight.findMany({
      where: { userId },
      orderBy: { generatedAt: "desc" },
      take: EXPORT_LIST_LIMIT,
    }),
    assistantAgents: db.assistantAgent.findMany({ where: { userId } }),
    assistantConversations: db.assistantConversation.findMany({
      where: { userId },
      orderBy: { lastMessageAt: "desc" },
      take: EXPORT_LIST_LIMIT,
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: { role: true, content: true, toolCalls: true, createdAt: true },
        },
      },
    }),
    gamificationProfile: db.gamificationProfile.findUnique({ where: { userId } }),
    gamificationSpins: db.gamificationSpinLog.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    subscription: db.subscription.findUnique({ where: { userId } }),
    couponRedemptions: db.couponRedemption.findMany({
      where: { userId },
      select: {
        coupon: { select: { code: true } },
        plan: true,
        interval: true,
        originalCents: true,
        finalCents: true,
        status: true,
        createdAt: true,
        confirmedAt: true,
      },
    }),
    referralCode: db.referralCode.findUnique({ where: { userId } }),
    referralsMade: db.referral.findMany({ where: { referrerId: userId } }),
    referredBy: db.referral.findUnique({ where: { referredId: userId } }),
    sessions: db.session.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, expiresAt: true, ipAddress: true, userAgent: true },
    }),
    pushDevices: db.pushToken.findMany({
      where: { userId },
      select: { platform: true, deviceName: true, createdAt: true, lastUsedAt: true },
    }),
    groupMemberships: db.groupMember.findMany({
      where: { userId },
      include: { group: { select: { id: true, name: true } } },
    }),
    openFinanceConsents: db.openFinanceConsent.findMany({
      where: { userId },
      select: {
        id: true,
        bankIspb: true,
        bankName: true,
        consentId: true,
        status: true,
        permissions: true,
        tokenExpiresAt: true,
        lastSyncAt: true,
        syncError: true,
        createdAt: true,
        revokedAt: true,
      },
    }),
  });

  const exportData = {
    exportedAt: new Date().toISOString(),
    ...data,
  };

  c.header(
    "Content-Disposition",
    `attachment; filename="meus-dados-controlai-${new Date().toISOString().slice(0, 10)}.json"`
  );
  return c.json(exportData);
});

export default app;
