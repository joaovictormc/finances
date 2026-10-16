import { db } from "@finances/db";
import { sendNotification, type NotificationInput } from "./notifications";
import { todayInReportTimeZone } from "./report-period";
import { getPlan } from "./plans";

// ── Regras puras (datas no calendário de São Paulo) ──────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/** Dias inteiros entre duas datas puras (meia-noite UTC), b − a. */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

/** Lembrete de conta: 3 dias antes e no dia do vencimento. */
export const BILL_REMINDER_DAYS = [3, 0] as const;

/** Assinatura Pix: 5 dias antes e no dia em que o período vence. */
export const PIX_EXPIRY_REMINDER_DAYS = [5, 0] as const;

/** Marcos de meta: cada um avisa uma vez só. */
export const GOAL_MILESTONES = [50, 75, 100] as const;

/**
 * Conta já paga neste ciclo? Pagamento registrado nos 10 dias antes do
 * vencimento (ou depois) conta como pago — não faz sentido lembrar.
 */
export function billAlreadyPaid(dueDate: Date, lastPaidDate: Date | null): boolean {
  if (!lastPaidDate) return false;
  return daysBetween(lastPaidDate, dueDate) <= 10;
}

/**
 * Maior marco cruzado entre o valor antigo e o novo (só subindo). Pular de
 * 40% para 100% avisa uma vez, com "concluída" — não três avisos seguidos.
 */
export function crossedMilestone(previous: number, current: number, target: number): number | null {
  if (target <= 0 || current <= previous) return null;
  const before = (previous / target) * 100;
  const after = (current / target) * 100;
  const crossed = GOAL_MILESTONES.filter((m) => before < m && after >= m);
  return crossed.length ? crossed[crossed.length - 1]! : null;
}

// ── Envio com proteção contra repetição ──────────────────────────────────────

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const ddmm = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/**
 * Envia uma vez por chave. A rotina diária pode rodar de novo (reinício,
 * nova tentativa) sem repetir o aviso: a chave fica gravada no metadata da
 * própria notificação.
 */
async function notifyOnce(userId: string, dedupKey: string, input: NotificationInput): Promise<boolean> {
  const existing = await db.notification.findFirst({
    where: { userId, metadata: { path: ["dedupKey"], equals: dedupKey } },
    select: { id: true },
  });
  if (existing) return false;
  await sendNotification(userId, { ...input, metadata: { ...input.metadata, dedupKey } });
  return true;
}

// ── Contas a pagar ───────────────────────────────────────────────────────────

export async function sendBillReminders(now = new Date()): Promise<number> {
  const today = todayInReportTimeZone(now);
  const dates = BILL_REMINDER_DAYS.map((d) => new Date(today.getTime() + d * DAY_MS));

  const bills = await db.recurringBill.findMany({
    where: { isActive: true, nextDueDate: { in: dates } },
    select: { id: true, userId: true, name: true, expectedAmount: true, nextDueDate: true, lastPaidDate: true },
  });

  let sent = 0;
  for (const bill of bills) {
    const due = bill.nextDueDate!;
    if (billAlreadyPaid(due, bill.lastPaidDate)) continue;
    const days = daysBetween(today, due);
    const amount = bill.expectedAmount ? brl.format(Number(bill.expectedAmount)) : null;
    const when = days === 0 ? "vence hoje" : `vence em ${days} dias (${ddmm(due)})`;

    const ok = await notifyOnce(bill.userId, `bill:${bill.id}:${due.toISOString().slice(0, 10)}:${days}`, {
      type: "bill_reminder",
      title: `${bill.name} ${when}`,
      body: amount ? `Valor previsto: ${amount}.` : "Confira o valor no app e programe o pagamento.",
      link: "/bills",
      emailTemplate: "bill-reminder",
      emailData: { billName: bill.name, amount: amount ?? "—", daysUntilDue: days, dueDate: ddmm(due) },
    });
    if (ok) sent++;
  }
  return sent;
}

// ── Assinatura Pix perto de vencer ───────────────────────────────────────────

export async function sendPixExpiryReminders(now = new Date()): Promise<number> {
  const today = todayInReportTimeZone(now);
  // Pix não renova sozinho; cartão renova pelo Mercado Pago (e avisa se falhar,
  // no webhook). Concessão manual (sem prazo) e cancelada não entram.
  const subscriptions = await db.subscription.findMany({
    where: {
      status: "active",
      mpPreapprovalId: { startsWith: "pix:" },
      currentPeriodEnd: {
        gte: new Date(today.getTime() - DAY_MS),
        lt: new Date(today.getTime() + 7 * DAY_MS),
      },
    },
    select: { userId: true, plan: true, currentPeriodEnd: true },
  });

  let sent = 0;
  for (const sub of subscriptions) {
    const end = todayInReportTimeZone(sub.currentPeriodEnd!);
    const days = daysBetween(today, end);
    if (!(PIX_EXPIRY_REMINDER_DAYS as readonly number[]).includes(days)) continue;
    const planName = getPlan(sub.plan).name;
    const title = days === 0 ? `Seu plano ${planName} vence hoje` : `Seu plano ${planName} vence em ${days} dias`;
    const body =
      days === 0
        ? "Pagamentos por Pix não renovam sozinhos. Renove nos próximos 3 dias para não voltar ao plano Free."
        : `Pagamentos por Pix não renovam sozinhos. Renove até ${ddmm(end)} para continuar com o ${planName}.`;

    const ok = await notifyOnce(sub.userId, `pix-expiry:${end.toISOString().slice(0, 10)}:${days}`, {
      type: "subscription_expiring",
      title,
      body,
      link: "/settings/billing",
      emailTemplate: "notice",
      emailData: { title, body, ctaLabel: "Renovar plano", ctaUrl: `${appUrl()}/settings/billing` },
    });
    if (ok) sent++;
  }
  return sent;
}

/** Cobrança recorrente no cartão não aprovada (chamado pelo webhook). */
export async function notifyCardPaymentFailed(userId: string, plan: string): Promise<void> {
  const planName = getPlan(plan).name;
  const title = `Não conseguimos renovar seu plano ${planName}`;
  const body = "A cobrança no cartão não foi aprovada. Confira a forma de pagamento para manter o acesso.";
  await sendNotification(userId, {
    type: "subscription_payment_failed",
    title,
    body,
    link: "/settings/billing",
    emailTemplate: "notice",
    emailData: { title, body, ctaLabel: "Ver assinatura", ctaUrl: `${appUrl()}/settings/billing` },
  });
}

// ── Marcos de meta ───────────────────────────────────────────────────────────

/**
 * Avisa quando a meta cruza 50%, 75% ou 100%. Meta de grupo avisa todos os
 * membros; pessoal, só o dono. Cada marco avisa uma vez por pessoa, mesmo se
 * o valor cair e subir de novo.
 */
export async function notifyGoalMilestone(
  goal: { id: string; name: string; userId: string; groupId: string | null; targetAmount: unknown; currentAmount: unknown },
  previousAmount: number
): Promise<void> {
  const milestone = crossedMilestone(previousAmount, Number(goal.currentAmount), Number(goal.targetAmount));
  if (milestone === null) return;

  const title = milestone === 100 ? `Meta concluída: ${goal.name}` : `${goal.name} chegou a ${milestone}%`;
  const body =
    milestone === 100
      ? `${goal.groupId ? "Vocês juntaram" : "Você juntou"} ${brl.format(Number(goal.targetAmount))}. Hora de comemorar.`
      : `Já são ${brl.format(Number(goal.currentAmount))} de ${brl.format(Number(goal.targetAmount))}.`;
  const input: NotificationInput = { type: "goal_milestone", title, body, link: "/goals" };
  const key = `goal:${goal.id}:${milestone}`;

  if (goal.groupId) {
    const members = await db.groupMember.findMany({ where: { groupId: goal.groupId }, select: { userId: true } });
    await Promise.all(members.map((m) => notifyOnce(m.userId, key, input)));
  } else {
    await notifyOnce(goal.userId, key, input);
  }
}
