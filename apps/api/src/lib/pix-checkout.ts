import { db } from "@finances/db";

/**
 * Janela em que um checkout Pix ainda pode ser confirmado. O QR e o txid não
 * sobrevivem semanas, e a lista de eventos só cresce — nada fecha o que nunca
 * foi pago. Confirmar um checkout velho é, na prática, clique errado na lista.
 */
export const PIX_CHECKOUT_MAX_AGE_DAYS = 7;

/** Antecedência do aviso ao admin antes de o checkout vencer. */
export const PIX_CHECKOUT_WARN_DAYS = 2;

/** Até onde a varredura olha pra trás. Além disso o aviso já foi dado. */
const SCAN_WINDOW_DAYS = 30;

const DAY_MS = 86_400_000;

export type PixCheckoutStage = "expiring" | "expired";

export function pixCheckoutExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + PIX_CHECKOUT_MAX_AGE_DAYS * DAY_MS);
}

export function isPixCheckoutExpired(createdAt: Date, now = new Date()): boolean {
  return pixCheckoutExpiresAt(createdAt).getTime() < now.getTime();
}

/**
 * Em que ponto da janela o checkout está: `expired` passou do prazo,
 * `expiring` entrou na reta final, `null` ainda tem folga.
 *
 * É o mesmo cálculo que a rota de confirmação usa pra recusar. Se divergissem,
 * o admin receberia aviso de um prazo e a tela aplicaria outro.
 */
export function pixCheckoutStage(createdAt: Date, now = new Date()): PixCheckoutStage | null {
  const remainingMs = pixCheckoutExpiresAt(createdAt).getTime() - now.getTime();
  if (remainingMs < 0) return "expired";
  if (remainingMs <= PIX_CHECKOUT_WARN_DAYS * DAY_MS) return "expiring";
  return null;
}

export type PendingPixCheckout = {
  eventId: string;
  txid: string;
  userId: string;
  plan: string;
  amount: number | null;
  createdAt: Date;
  expiresAt: Date;
  stage: PixCheckoutStage | null;
};

/**
 * Checkouts Pix criados e nunca confirmados.
 *
 * A confirmação é reconhecida pelo `txid` gravado no payload do evento
 * `pix_payment_confirmed`, não pelo `mpEventId` — esse carrega um timestamp
 * no fim e não dá pra casar por igualdade.
 */
export async function listPendingPixCheckouts(now = new Date()): Promise<PendingPixCheckout[]> {
  const since = new Date(now.getTime() - SCAN_WINDOW_DAYS * DAY_MS);

  const [created, confirmed] = await Promise.all([
    db.paymentEvent.findMany({
      where: { type: "pix_checkout_created", processedAt: { gte: since } },
      orderBy: { processedAt: "asc" },
    }),
    db.paymentEvent.findMany({
      where: { type: "pix_payment_confirmed", processedAt: { gte: since } },
      select: { rawPayload: true },
    }),
  ]);

  const confirmedTxids = new Set(
    confirmed
      .map((event) => (event.rawPayload as { txid?: string } | null)?.txid)
      .filter((txid): txid is string => !!txid)
  );

  const pending: PendingPixCheckout[] = [];

  for (const event of created) {
    const payload = event.rawPayload as {
      userId?: string;
      plan?: string;
      txid?: string;
      amount?: number;
    } | null;

    if (!payload?.txid || !payload.userId || !payload.plan) continue;
    if (confirmedTxids.has(payload.txid)) continue;

    pending.push({
      eventId: event.id,
      txid: payload.txid,
      userId: payload.userId,
      plan: payload.plan,
      amount: payload.amount ?? null,
      createdAt: event.processedAt,
      expiresAt: pixCheckoutExpiresAt(event.processedAt),
      stage: pixCheckoutStage(event.processedAt, now),
    });
  }

  return pending;
}
