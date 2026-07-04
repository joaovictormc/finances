import { Hono } from "hono";
import { db } from "@finances/db";
import { requireAuth, type AuthVariables } from "../middleware/auth";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth);

// Exporta todos os dados pessoais do usuário em JSON (LGPD, art. 18, IV/V).
// Exclui deliberadamente sessões, contas OAuth/senha e segredos de 2FA — não
// são "dados pessoais" que fazem sentido num export de portabilidade, e
// incluí-los vazaria credenciais ativas. Tokens do Open Finance também saem
// redigidos pelo mesmo motivo.
app.get("/export", async (c) => {
  const userId = c.get("userId");

  const [
    user,
    profile,
    financialAccounts,
    transactions,
    categories,
    budgets,
    goals,
    recurringBills,
    notifications,
    aiInsights,
    subscription,
    referralCode,
    referralsMade,
    referredBy,
    groupMemberships,
    openFinanceConsents,
    botConversations,
  ] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, emailVerified: true, role: true, createdAt: true, updatedAt: true },
    }),
    db.userProfile.findUnique({ where: { userId } }),
    db.financialAccount.findMany({ where: { userId } }),
    db.transaction.findMany({ where: { userId } }),
    db.category.findMany({ where: { userId } }),
    db.budget.findMany({ where: { userId } }),
    db.goal.findMany({ where: { userId } }),
    db.recurringBill.findMany({ where: { userId } }),
    db.notification.findMany({ where: { userId } }),
    db.aiInsight.findMany({ where: { userId } }),
    db.subscription.findUnique({ where: { userId } }),
    db.referralCode.findUnique({ where: { userId } }),
    db.referral.findMany({ where: { referrerId: userId } }),
    db.referral.findUnique({ where: { referredId: userId } }),
    db.groupMember.findMany({ where: { userId }, include: { group: { select: { id: true, name: true } } } }),
    db.openFinanceConsent.findMany({
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
    db.botConversation.findMany({ where: { userId }, include: { messages: true } }),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    user,
    // telegramChatId é BigInt — JSON.stringify não serializa BigInt nativamente.
    profile: profile ? { ...profile, telegramChatId: profile.telegramChatId?.toString() ?? null } : null,
    financialAccounts,
    transactions,
    categories,
    budgets,
    goals,
    recurringBills,
    notifications,
    aiInsights,
    subscription,
    referralCode,
    referralsMade,
    referredBy,
    groupMemberships,
    openFinanceConsents,
    botConversations,
  };

  c.header(
    "Content-Disposition",
    `attachment; filename="meus-dados-controlai-${new Date().toISOString().slice(0, 10)}.json"`
  );
  return c.json(exportData);
});

export default app;
