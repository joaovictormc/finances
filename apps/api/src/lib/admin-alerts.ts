import { db } from "@finances/db";
import { sendNotification, type NotificationInput } from "./notifications";
import { listPendingPixCheckouts } from "./pix-checkout";

/**
 * Avisos que só o admin recebe: pendências que dependem de alguém validar no
 * painel. Vão pelos mesmos canais de qualquer aviso (sininho, push e e-mail,
 * respeitando a preferência de e-mail de cada admin).
 */
export async function notifyAdmins(input: NotificationInput): Promise<number> {
  const admins = await db.user.findMany({ where: { role: "admin" }, select: { id: true } });
  if (admins.length === 0) {
    console.warn(`[admin-alerts] Nenhuma conta admin para avisar: ${input.title}`);
    return 0;
  }
  for (const admin of admins) await sendNotification(admin.id, input);
  return admins.length;
}

export type AdminPending = { total: number; changelogDrafts: number; pixCheckouts: number };

/** Contador do painel: rascunhos de novidade e Pix que ainda dá para confirmar. */
export async function adminPendingCounts(now = new Date()): Promise<AdminPending> {
  const [changelogDrafts, pix] = await Promise.all([
    db.changelogRelease.count({ where: { publishedAt: null } }),
    listPendingPixCheckouts(now),
  ]);
  const pixCheckouts = pix.filter((checkout) => checkout.stage !== "expired").length;
  return { total: changelogDrafts + pixCheckouts, changelogDrafts, pixCheckouts };
}
