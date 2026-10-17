import { db } from "@finances/db";

/**
 * Piso de cobrança com cupom: um desconto que zere o preço criaria uma
 * assinatura de R$ 0,00 no Mercado Pago (e um Pix sem valor). Cupom de
 * "100%" vira o mínimo; acesso gratuito de verdade é concessão do admin.
 */
export const MIN_CHARGE_CENTS = 100;

type CouponDiscount = { percentOff: number | null; amountOffCents: number | null };

/** Preço por cobrança com o cupom aplicado. */
export function applyDiscount(priceCents: number, coupon: CouponDiscount): number {
  const off = coupon.percentOff ? Math.round((priceCents * coupon.percentOff) / 100) : (coupon.amountOffCents ?? 0);
  return Math.max(MIN_CHARGE_CENTS, priceCents - off);
}

export type CouponRejection = "nao_encontrado" | "inativo" | "ainda_nao_comecou" | "expirado" | "plano" | "esgotado" | "ja_usado";

export const COUPON_MESSAGES: Record<CouponRejection, string> = {
  nao_encontrado: "Cupom não encontrado.",
  inativo: "Este cupom não está mais ativo.",
  ainda_nao_comecou: "Este cupom ainda não está valendo.",
  expirado: "Este cupom expirou.",
  plano: "Este cupom não vale para o plano escolhido.",
  esgotado: "Este cupom atingiu o limite de usos.",
  ja_usado: "Você já usou este cupom.",
};

type CouponRow = NonNullable<Awaited<ReturnType<typeof db.coupon.findUnique>>>;

/** Regras do cupom sem banco (testáveis): ativo, período e plano. */
export function couponRuleRejection(coupon: CouponRow, plan: string, now: Date): CouponRejection | null {
  if (!coupon.active) return "inativo";
  if (coupon.startsAt && coupon.startsAt.getTime() > now.getTime()) return "ainda_nao_comecou";
  if (coupon.expiresAt && coupon.expiresAt.getTime() <= now.getTime()) return "expirado";
  if (coupon.plans.length > 0 && !coupon.plans.includes(plan)) return "plano";
  return null;
}

/**
 * Cupom pode ser usado por esta pessoa neste plano? Só usos confirmados contam
 * no limite e no "já usou" — um checkout abandonado não gasta o cupom.
 *
 * Um uso por pessoa. No cartão o desconto acompanha todas as cobranças da
 * assinatura (o Mercado Pago repete o valor); no Pix, que é um pagamento por
 * período, vale só no pagamento em que foi usado.
 */
export async function checkCoupon(
  code: string,
  userId: string,
  plan: string,
  now = new Date()
): Promise<{ ok: true; coupon: CouponRow } | { ok: false; reason: CouponRejection }> {
  const coupon = await db.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!coupon) return { ok: false, reason: "nao_encontrado" };

  const rule = couponRuleRejection(coupon, plan, now);
  if (rule) return { ok: false, reason: rule };

  const [usedByUser, confirmed] = await Promise.all([
    db.couponRedemption.findFirst({ where: { couponId: coupon.id, userId, status: "confirmed" }, select: { id: true } }),
    coupon.maxRedemptions ? db.couponRedemption.count({ where: { couponId: coupon.id, status: "confirmed" } }) : 0,
  ]);
  if (usedByUser) return { ok: false, reason: "ja_usado" };
  if (coupon.maxRedemptions && confirmed >= coupon.maxRedemptions) return { ok: false, reason: "esgotado" };
  return { ok: true, coupon };
}

/** Reserva o uso no checkout (pendente). Um checkout novo da mesma pessoa substitui o anterior. */
export async function reserveRedemption(input: {
  couponId: string;
  userId: string;
  checkoutRef: string;
  plan: string;
  interval: string;
  originalCents: number;
  finalCents: number;
}) {
  const data = {
    checkoutRef: input.checkoutRef,
    plan: input.plan,
    interval: input.interval,
    originalCents: input.originalCents,
    finalCents: input.finalCents,
    status: "pending",
  };
  await db.couponRedemption.upsert({
    where: { couponId_userId: { couponId: input.couponId, userId: input.userId } },
    update: data,
    create: { couponId: input.couponId, userId: input.userId, ...data },
  });
}

/** Pagamento confirmado (webhook do cartão ou Pix confirmado pelo admin): o uso passa a contar. */
export async function confirmRedemption(checkoutRef: string): Promise<void> {
  await db.couponRedemption.updateMany({
    where: { checkoutRef, status: "pending" },
    data: { status: "confirmed", confirmedAt: new Date() },
  });
}
