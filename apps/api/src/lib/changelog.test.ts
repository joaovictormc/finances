import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  changelogRelease: { findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  userProfile: { findUnique: vi.fn(), upsert: vi.fn() },
  user: { findUnique: vi.fn(), findMany: vi.fn() },
  notification: { createMany: vi.fn() },
}));
const sendEmailMock = vi.hoisted(() => vi.fn());

vi.mock("@finances/db", () => ({ db: dbMock, Prisma: {} }));
vi.mock("./email", () => ({ sendEmail: sendEmailMock }));

import { broadcastRelease, summarizeItems, unseenReleases } from "./changelog";

const NOW = new Date("2026-10-18T12:00:00.000Z");

const release = {
  id: "r1",
  version: "1.3.0",
  title: "Teclado não cobre mais os campos",
  items: [
    { kind: "fix", text: "O teclado não cobre mais os campos dos formulários" },
    { kind: "improvement", text: "Toque nas categorias com o teclado aberto" },
    { kind: "new", text: "Tela de Novidades" },
  ],
  platforms: ["android"],
  publishedAt: NOW,
  notifiedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

beforeEach(() => vi.clearAllMocks());

describe("summarizeItems", () => {
  it("mostra os dois primeiros itens e quantos faltam", () => {
    expect(summarizeItems(release.items as never)).toBe(
      "Correção: O teclado não cobre mais os campos dos formulários · Melhoria: Toque nas categorias com o teclado aberto · e mais 1"
    );
  });
});

describe("unseenReleases", () => {
  it("quem nunca fechou a janela parte da criação da conta", async () => {
    dbMock.userProfile.findUnique.mockResolvedValue(null);
    dbMock.user.findUnique.mockResolvedValue({ createdAt: new Date("2026-10-01T00:00:00.000Z") });
    dbMock.changelogRelease.findMany.mockResolvedValue([release]);

    const result = await unseenReleases("u1", "android");

    const where = dbMock.changelogRelease.findMany.mock.calls[0]![0].where;
    expect(where.publishedAt).toEqual({ gt: new Date("2026-10-01T00:00:00.000Z") });
    expect(where.OR).toEqual([{ platforms: { isEmpty: true } }, { platforms: { has: "android" } }]);
    expect(result[0]).toMatchObject({ id: "r1", version: "1.3.0", publishedAt: NOW.toISOString() });
  });

  it("depois de fechar, só o que saiu depois", async () => {
    const seenAt = new Date("2026-10-17T00:00:00.000Z");
    dbMock.userProfile.findUnique.mockResolvedValue({ changelogSeenAt: seenAt });
    dbMock.user.findUnique.mockResolvedValue({ createdAt: new Date("2026-01-01T00:00:00.000Z") });
    dbMock.changelogRelease.findMany.mockResolvedValue([]);

    await unseenReleases("u1");

    const where = dbMock.changelogRelease.findMany.mock.calls[0]![0].where;
    expect(where.publishedAt).toEqual({ gt: seenAt });
    expect(where.OR).toBeUndefined();
  });
});

describe("broadcastRelease", () => {
  const users = [
    { id: "a", email: "a@x.com", name: "Ana", profile: { notifyEmail: true } },
    { id: "b", email: "b@x.com", name: "Bia", profile: { notifyEmail: false } },
    { id: "c", email: "c@x.com", name: "Caio", profile: null },
  ];

  it("não dispara de novo quando outra execução já reservou", async () => {
    dbMock.changelogRelease.updateMany.mockResolvedValue({ count: 0 });
    expect(await broadcastRelease("r1", { inApp: true, email: true })).toEqual({ users: 0, emails: 0 });
    expect(dbMock.notification.createMany).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("sininho para todos e e-mail só para quem não desligou", async () => {
    dbMock.changelogRelease.updateMany.mockResolvedValue({ count: 1 });
    dbMock.changelogRelease.findUnique.mockResolvedValue(release);
    dbMock.user.findMany.mockResolvedValueOnce(users).mockResolvedValueOnce([]);

    const result = await broadcastRelease("r1", { inApp: true, email: true });

    expect(result).toEqual({ users: 3, emails: 2 });
    const rows = dbMock.notification.createMany.mock.calls[0]![0].data;
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ userId: "a", type: "changelog", metadata: { link: "/novidades", releaseId: "r1" } });
    expect(sendEmailMock.mock.calls.map((call) => call[0].to)).toEqual(["a@x.com", "c@x.com"]);
    expect(sendEmailMock.mock.calls[0]![0]).toMatchObject({ template: "changelog", subject: "Novidades: Teclado não cobre mais os campos" });
    // Segundo lote continua de onde o primeiro parou.
    expect(dbMock.user.findMany.mock.calls[1]![0]).toMatchObject({ skip: 1, cursor: { id: "c" } });
  });

  it("sem e-mail pedido, só o sininho", async () => {
    dbMock.changelogRelease.updateMany.mockResolvedValue({ count: 1 });
    dbMock.changelogRelease.findUnique.mockResolvedValue(release);
    dbMock.user.findMany.mockResolvedValueOnce(users).mockResolvedValueOnce([]);

    await broadcastRelease("r1", { inApp: true, email: false });

    expect(dbMock.notification.createMany).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
