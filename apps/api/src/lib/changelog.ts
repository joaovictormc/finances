import { db, Prisma } from "@finances/db";
import {
  CHANGELOG_KIND_LABELS,
  type ChangelogItem,
  type ChangelogPlatform,
  type PublishedChangelogRelease,
} from "@finances/validations";
import { sendEmail } from "./email";

type ReleaseRow = NonNullable<Awaited<ReturnType<typeof db.changelogRelease.findUnique>>>;

/** Link da tela de Novidades (web; o app traduz em lib/notification-links.ts). */
export const CHANGELOG_LINK = "/novidades";

/** Usuários processados por vez no disparo. */
const BROADCAST_BATCH = 500;

export function toPublicRelease(row: ReleaseRow): PublishedChangelogRelease {
  return {
    id: row.id,
    version: row.version,
    title: row.title,
    items: (row.items as ChangelogItem[] | null) ?? [],
    platforms: row.platforms as ChangelogPlatform[],
    publishedAt: (row.publishedAt ?? row.createdAt).toISOString(),
  };
}

/** Publicadas que valem para a plataforma: sem plataforma marcada vale para todas. */
function platformFilter(platform?: ChangelogPlatform): Prisma.ChangelogReleaseWhereInput {
  return platform ? { OR: [{ platforms: { isEmpty: true } }, { platforms: { has: platform } }] } : {};
}

export async function listPublishedReleases(platform?: ChangelogPlatform, take = 50) {
  const rows = await db.changelogRelease.findMany({
    where: { publishedAt: { not: null }, ...platformFilter(platform) },
    orderBy: { publishedAt: "desc" },
    take,
  });
  return rows.map(toPublicRelease);
}

/**
 * Novidades que a pessoa ainda não viu, mais recentes primeiro. A referência é
 * a última vez que fechou a janela; quem nunca fechou parte da criação da
 * conta, para não receber de cara todo o histórico.
 */
export async function unseenReleases(userId: string, platform?: ChangelogPlatform) {
  const [profile, user] = await Promise.all([
    db.userProfile.findUnique({ where: { userId }, select: { changelogSeenAt: true } }),
    db.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
  ]);
  const since = profile?.changelogSeenAt ?? user?.createdAt;
  if (!since) return [];
  const rows = await db.changelogRelease.findMany({
    where: { publishedAt: { gt: since }, ...platformFilter(platform) },
    orderBy: { publishedAt: "desc" },
    take: 10,
  });
  return rows.map(toPublicRelease);
}

export async function markChangelogSeen(userId: string, now = new Date()) {
  await db.userProfile.upsert({
    where: { userId },
    update: { changelogSeenAt: now },
    create: { userId, changelogSeenAt: now },
  });
}

/** Corpo curto do aviso: os dois primeiros itens e quantos faltam. */
export function summarizeItems(items: ChangelogItem[]): string {
  const shown = items.slice(0, 2).map((item) => `${CHANGELOG_KIND_LABELS[item.kind]}: ${item.text}`);
  const rest = items.length - shown.length;
  return rest > 0 ? `${shown.join(" · ")} · e mais ${rest}` : shown.join(" · ");
}

/**
 * Avisa todo mundo de uma novidade publicada: sininho (uma linha por usuário)
 * e, se pedido, e-mail para quem não desligou os avisos por e-mail. Sem push,
 * por decisão de produto.
 *
 * Reserva o disparo antes de começar (notifiedAt nulo → agora): um job
 * repetido ou dois cliques não mandam o aviso duas vezes.
 */
export async function broadcastRelease(
  releaseId: string,
  options: { inApp: boolean; email: boolean }
): Promise<{ users: number; emails: number }> {
  const claimed = await db.changelogRelease.updateMany({
    where: { id: releaseId, publishedAt: { not: null }, notifiedAt: null },
    data: { notifiedAt: new Date() },
  });
  if (claimed.count === 0) return { users: 0, emails: 0 };

  const release = await db.changelogRelease.findUnique({ where: { id: releaseId } });
  if (!release) return { users: 0, emails: 0 };
  const items = (release.items as ChangelogItem[] | null) ?? [];
  const title = `Novidades: ${release.title}`;
  const body = summarizeItems(items);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

  let users = 0;
  let emails = 0;
  let cursor: string | undefined;
  for (;;) {
    const batch = await db.user.findMany({
      select: { id: true, email: true, name: true, profile: { select: { notifyEmail: true } } },
      orderBy: { id: "asc" },
      take: BROADCAST_BATCH,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
    });
    if (batch.length === 0) break;
    cursor = batch.at(-1)!.id;
    users += batch.length;

    if (options.inApp) {
      const sentAt = new Date();
      await db.notification.createMany({
        data: batch.map((user) => ({
          userId: user.id,
          type: "changelog",
          channel: "inapp",
          title,
          body,
          metadata: { link: CHANGELOG_LINK, releaseId },
          status: "sent",
          sentAt,
        })),
      });
    }

    if (options.email) {
      for (const user of batch) {
        if (!user.email || user.profile?.notifyEmail === false) continue;
        await sendEmail({
          to: user.email,
          subject: title,
          template: "changelog",
          data: {
            name: user.name,
            title: release.title,
            version: release.version,
            items,
            ctaUrl: `${appUrl}${CHANGELOG_LINK}`,
          },
        });
        emails++;
      }
    }
  }
  return { users, emails };
}
