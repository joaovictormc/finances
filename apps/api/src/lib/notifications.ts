import { db, Prisma } from "@finances/db";
import { sendEmail } from "./email";
import { bot } from "../routes/bots/telegram";

export type NotificationInput = {
  type: string; // bill_reminder | budget_alert | overdraft_warning | sync_complete | new_transaction | insight_ready | goal_milestone
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  emailTemplate?: string;
  emailData?: Record<string, unknown>;
};

// Dispara uma notificação para o usuário nos canais disponíveis (email + telegram).
// Sempre respeita UserProfile.aiInsightsEnabled para tipos gerados por IA.
const AI_DRIVEN_TYPES = new Set(["insight_ready", "budget_alert", "overdraft_warning"]);

export async function sendNotification(userId: string, input: NotificationInput) {
  const profile = await db.userProfile.findUnique({ where: { userId } });
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });

  if (AI_DRIVEN_TYPES.has(input.type) && profile?.aiInsightsEnabled === false) {
    return;
  }

  // Email e Telegram são canais independentes — rodam em paralelo em vez de
  // sequenciais, já que um atraso/falha num não deve segurar o outro (isso
  // importa especialmente em lotes, ex: alertas de orçamento pra vários
  // membros de um grupo, onde a latência de cada chamada se acumulava).
  await Promise.allSettled([
    (async () => {
      if (!user?.email || profile?.notifyEmail === false) return;
      const notification = await db.notification.create({
        data: {
          userId,
          type: input.type,
          channel: "email",
          title: input.title,
          body: input.body,
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
        },
      });

      try {
        await sendEmail({
          to: user.email,
          subject: input.title,
          template: input.emailTemplate ?? "ai-insight",
          data: input.emailData ?? { title: input.title, body: input.body, name: user.name },
        });
        await db.notification.update({
          where: { id: notification.id },
          data: { status: "sent", sentAt: new Date() },
        });
      } catch (err) {
        await db.notification.update({
          where: { id: notification.id },
          data: { status: "failed", error: (err as Error).message },
        });
      }
    })(),
    (async () => {
      if (!profile?.telegramChatId || profile?.notifyTelegram === false) return;
      const notification = await db.notification.create({
        data: {
          userId,
          type: input.type,
          channel: "telegram",
          title: input.title,
          body: input.body,
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
        },
      });

      try {
        await bot.api.sendMessage(Number(profile.telegramChatId), `*${input.title}*\n\n${input.body}`, {
          parse_mode: "Markdown",
        });
        await db.notification.update({
          where: { id: notification.id },
          data: { status: "sent", sentAt: new Date() },
        });
      } catch (err) {
        await db.notification.update({
          where: { id: notification.id },
          data: { status: "failed", error: (err as Error).message },
        });
      }
    })(),
  ]);
}
