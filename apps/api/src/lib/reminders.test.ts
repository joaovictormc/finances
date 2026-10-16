import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  recurringBill: { findMany: vi.fn() },
  subscription: { findMany: vi.fn() },
  notification: { findFirst: vi.fn() },
  groupMember: { findMany: vi.fn() },
}));
const sendNotificationMock = vi.hoisted(() => vi.fn());

vi.mock("@finances/db", () => ({ db: dbMock, Prisma: {} }));
vi.mock("./notifications", () => ({ sendNotification: sendNotificationMock }));

import {
  billAlreadyPaid,
  crossedMilestone,
  daysBetween,
  notifyGoalMilestone,
  sendBillReminders,
  sendPixExpiryReminders,
} from "./reminders";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
// 10h em São Paulo do dia 16/10.
const NOW = new Date("2026-10-16T13:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.notification.findFirst.mockResolvedValue(null);
});

describe("regras puras", () => {
  it("conta dias entre datas puras", () => {
    expect(daysBetween(day("2026-10-16"), day("2026-10-19"))).toBe(3);
    expect(daysBetween(day("2026-12-30"), day("2027-01-02"))).toBe(3);
  });

  it("considera paga a conta com pagamento nos 10 dias antes do vencimento", () => {
    expect(billAlreadyPaid(day("2026-10-19"), day("2026-10-12"))).toBe(true);
    expect(billAlreadyPaid(day("2026-10-19"), day("2026-09-19"))).toBe(false);
    expect(billAlreadyPaid(day("2026-10-19"), null)).toBe(false);
  });

  it("avisa só o maior marco cruzado, e só subindo", () => {
    expect(crossedMilestone(400, 520, 1000)).toBe(50);
    expect(crossedMilestone(400, 1000, 1000)).toBe(100);
    expect(crossedMilestone(500, 600, 1000)).toBeNull(); // já tinha passado de 50
    expect(crossedMilestone(800, 700, 1000)).toBeNull(); // caiu
    expect(crossedMilestone(0, 100, 0)).toBeNull();
  });
});

describe("sendBillReminders", () => {
  it("avisa 3 dias antes e no dia, com o texto de cada caso", async () => {
    dbMock.recurringBill.findMany.mockResolvedValue([
      { id: "b1", userId: "u1", name: "Internet", expectedAmount: 119.9, nextDueDate: day("2026-10-19"), lastPaidDate: null },
      { id: "b2", userId: "u1", name: "Aluguel", expectedAmount: null, nextDueDate: day("2026-10-16"), lastPaidDate: null },
    ]);

    expect(await sendBillReminders(NOW)).toBe(2);
    const where = dbMock.recurringBill.findMany.mock.calls[0]![0].where;
    expect(where.nextDueDate.in).toEqual([day("2026-10-19"), day("2026-10-16")]);

    const [first, second] = sendNotificationMock.mock.calls.map((c) => c[1]);
    expect(first.title).toBe("Internet vence em 3 dias (19/10)");
    expect(first.body).toMatch(/R\$\s119,90/); // Intl usa espaço não separável
    expect(first.metadata.dedupKey).toBe("bill:b1:2026-10-19:3");
    expect(second.title).toBe("Aluguel vence hoje");
  });

  it("não repete o aviso se a rotina rodar de novo", async () => {
    dbMock.recurringBill.findMany.mockResolvedValue([
      { id: "b1", userId: "u1", name: "Internet", expectedAmount: 119.9, nextDueDate: day("2026-10-19"), lastPaidDate: null },
    ]);
    dbMock.notification.findFirst.mockResolvedValue({ id: "já-enviada" });

    expect(await sendBillReminders(NOW)).toBe(0);
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it("pula conta já paga neste ciclo", async () => {
    dbMock.recurringBill.findMany.mockResolvedValue([
      { id: "b1", userId: "u1", name: "Internet", expectedAmount: 119.9, nextDueDate: day("2026-10-16"), lastPaidDate: day("2026-10-14") },
    ]);
    expect(await sendBillReminders(NOW)).toBe(0);
  });
});

describe("sendPixExpiryReminders", () => {
  it("avisa 5 dias antes e no dia; ignora outros dias", async () => {
    dbMock.subscription.findMany.mockResolvedValue([
      { userId: "u1", plan: "pro", currentPeriodEnd: new Date("2026-10-21T15:00:00.000Z") }, // 5 dias
      { userId: "u2", plan: "familia", currentPeriodEnd: new Date("2026-10-16T20:00:00.000Z") }, // hoje
      { userId: "u3", plan: "pro", currentPeriodEnd: new Date("2026-10-18T15:00:00.000Z") }, // 2 dias: não
    ]);

    expect(await sendPixExpiryReminders(NOW)).toBe(2);
    const titles = sendNotificationMock.mock.calls.map((c) => c[1].title);
    expect(titles).toEqual(["Seu plano Pro vence em 5 dias", "Seu plano Família vence hoje"]);
    expect(dbMock.subscription.findMany.mock.calls[0]![0].where.mpPreapprovalId).toEqual({ startsWith: "pix:" });
  });
});

describe("notifyGoalMilestone", () => {
  const goal = { id: "g1", name: "Viagem", userId: "u1", groupId: null, targetAmount: 1000, currentAmount: 760 };

  it("avisa o dono da meta pessoal ao cruzar 75%", async () => {
    await notifyGoalMilestone(goal, 600);
    expect(sendNotificationMock).toHaveBeenCalledTimes(1);
    expect(sendNotificationMock.mock.calls[0]![0]).toBe("u1");
    expect(sendNotificationMock.mock.calls[0]![1]).toMatchObject({ type: "goal_milestone", title: "Viagem chegou a 75%" });
  });

  it("em meta de grupo avisa todos os membros", async () => {
    dbMock.groupMember.findMany.mockResolvedValue([{ userId: "u1" }, { userId: "u2" }]);
    await notifyGoalMilestone({ ...goal, groupId: "grp", currentAmount: 1000 }, 900);
    expect(sendNotificationMock.mock.calls.map((c) => c[0])).toEqual(["u1", "u2"]);
    expect(sendNotificationMock.mock.calls[0]![1].title).toBe("Meta concluída: Viagem");
    expect(sendNotificationMock.mock.calls[0]![1].body).toContain("Vocês juntaram");
  });

  it("não avisa sem cruzar marco", async () => {
    await notifyGoalMilestone({ ...goal, currentAmount: 700 }, 600);
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });
});
