import { Worker, type Job } from "bullmq";
import { db } from "@finances/db";
import { redis } from "../../lib/redis";
import { sendNotification } from "../../lib/notifications";
import { isUniqueViolation } from "../../lib/prisma-errors";
import { listPendingPixCheckouts, type PixCheckoutStage } from "../../lib/pix-checkout";

const STAGE_TITLE: Record<PixCheckoutStage, string> = {
  expiring: "Pix pendente perto de vencer",
  expired: "Pix pendente venceu",
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const day = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

/**
 * Avisa o admin sobre checkout Pix que ninguém confirmou. Pix direto é
 * conciliado à mão, então um checkout esquecido vira plano não entregue de um
 * lado e cobrança não reconhecida do outro — e depois da janela a confirmação
 * nem é mais aceita.
 */
async function notifyPendingPixCheckouts() {
  const pending = (await listPendingPixCheckouts()).filter((checkout) => checkout.stage !== null);
  if (pending.length === 0) return;

  const admins = await db.user.findMany({ where: { role: "admin" }, select: { id: true } });
  if (admins.length === 0) {
    console.warn("[billing] Nenhuma conta admin para avisar sobre Pix pendente.");
    return;
  }

  for (const checkout of pending) {
    const stage = checkout.stage;
    if (!stage) continue;

    // Marcador de envio e trava de repetição na mesma linha: a varredura roda
    // todo dia e sem isso o admin receberia o mesmo aviso diariamente. Quem
    // garante o "uma vez por estágio" é o unique de mpEventId, não uma leitura
    // anterior — duas execuções simultâneas passariam por ela.
    //
    // O marcador é gravado antes do envio de propósito: `sendNotification` já
    // registra a falha na própria Notification, e insistir num e-mail que não
    // sai renderia um aviso por dia.
    try {
      await db.paymentEvent.create({
        data: {
          mpEventId: `pix_checkout_notified:${checkout.txid}:${stage}`,
          type: "pix_checkout_notified",
          rawPayload: {
            txid: checkout.txid,
            stage,
            userId: checkout.userId,
            plan: checkout.plan,
            expiresAt: checkout.expiresAt.toISOString(),
          },
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) continue; // já avisado neste estágio
      throw error;
    }

    const payer = await db.user.findUnique({
      where: { id: checkout.userId },
      select: { email: true, name: true },
    });

    const body = [
      `Plano ${checkout.plan} — ${checkout.amount === null ? "valor não registrado" : brl.format(checkout.amount)}`,
      `Pagador: ${payer?.name ?? "sem nome"} (${payer?.email ?? "sem e-mail"})`,
      `Checkout gerado em ${day.format(checkout.createdAt)}`,
      stage === "expired"
        ? `Venceu em ${day.format(checkout.expiresAt)} — a confirmação já não é aceita. Peça um novo checkout ao usuário.`
        : `Vence em ${day.format(checkout.expiresAt)} — confirme em /admin/checkouts antes disso.`,
    ].join("\n");

    for (const admin of admins) {
      await sendNotification(admin.id, {
        type: "pix_checkout_pending",
        link: "/admin/checkouts",
        title: `${STAGE_TITLE[stage]} — plano ${checkout.plan}`,
        body,
        metadata: { txid: checkout.txid, stage, eventId: checkout.eventId },
      });
    }
  }
}

export const billingWorker = new Worker(
  "billing",
  async (job: Job) => {
    switch (job.name) {
      case "scan-pix-checkouts":
        await notifyPendingPixCheckouts();
        return;
      default:
        console.warn(`[billing] Job desconhecido: ${job.name}`);
    }
  },
  { connection: redis, concurrency: 1 }
);

billingWorker.on("failed", (job, err) => {
  console.error(`[billing] Job ${job?.id} (${job?.name}) falhou:`, err.message);
});
