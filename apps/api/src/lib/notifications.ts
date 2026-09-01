import { db, Prisma } from "@finances/db";
import { sendEmail } from "./email";

export type NotificationInput = {
  type: string; // bill_reminder | budget_alert | overdraft_warning | sync_complete | new_transaction | insight_ready | goal_milestone | pix_checkout_pending
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  emailTemplate?: string;
  emailData?: Record<string, unknown>;
};

// Tipos gerados por IA respeitam UserProfile.aiInsightsEnabled: quem desligou
// não quer o aviso em canal nenhum, nem in-app.
const AI_DRIVEN_TYPES = new Set(["insight_ready", "budget_alert", "overdraft_warning"]);

/**
 * Registra a notificação para o usuário e tenta entregá-la por e-mail.
 *
 * O registro in-app existe sempre — é ele que a campainha lê. Antes a linha só
 * era criada quando o e-mail estava ligado, então quem desativou e-mail em
 * Configurações simplesmente não recebia nada, em canal nenhum.
 */
export async function sendNotification(userId: string, input: NotificationInput) {
  const profile = await db.userProfile.findUnique({ where: { userId } });
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  if (AI_DRIVEN_TYPES.has(input.type) && profile?.aiInsightsEnabled === false) {
    return;
  }

  const notification = await db.notification.create({
    data: {
      userId,
      type: input.type,
      channel: "inapp",
      title: input.title,
      body: input.body,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
      status: "sent",
      sentAt: new Date(),
    },
  });

  // E-mail é entrega adicional. Falhar aqui não apaga o aviso in-app — só fica
  // registrado na própria linha, pra quem for investigar por que não chegou.
  if (!user?.email || profile?.notifyEmail === false) return;

  try {
    await sendEmail({
      to: user.email,
      subject: input.title,
      template: input.emailTemplate ?? "ai-insight",
      data: input.emailData ?? { title: input.title, body: input.body, name: user.name },
    });
  } catch (err) {
    await db.notification.update({
      where: { id: notification.id },
      data: { error: `email: ${(err as Error).message}` },
    });
  }
}
