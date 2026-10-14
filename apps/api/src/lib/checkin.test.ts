import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  gamificationProfile: {
    upsert: vi.fn(),
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
}));
const settingsMock = vi.hoisted(() => vi.fn());

vi.mock("@finances/db", () => ({ db: dbMock, Prisma: {} }));
// Notificações abrem conexão com o Redis ao importar — fora do escopo aqui.
vi.mock("./notifications", () => ({ sendNotification: vi.fn() }));
vi.mock("./gamification-settings", () => ({
  getGamificationSettings: settingsMock,
  DEFAULT_SPIN_PRIZES: [],
}));

import { computeCheckin, dailyCheckin, visibleCheckinStreak } from "./gamification";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("computeCheckin", () => {
  it("starts a streak at 1 on the first check-in ever", () => {
    expect(computeCheckin({ checkinStreak: 0, lastCheckinDate: null }, day("2026-10-14"), 7, 50)).toEqual({
      alreadyCheckedIn: false,
      streak: 1,
      reward: 0,
    });
  });

  it("refuses a second check-in on the same day", () => {
    const state = { checkinStreak: 3, lastCheckinDate: day("2026-10-14") };
    expect(computeCheckin(state, day("2026-10-14"), 7, 50)).toEqual({ alreadyCheckedIn: true });
  });

  it("continues the streak on the next day", () => {
    const state = { checkinStreak: 3, lastCheckinDate: day("2026-10-13") };
    expect(computeCheckin(state, day("2026-10-14"), 7, 50)).toMatchObject({ streak: 4, reward: 0 });
  });

  it("resets to 1 after a missed day", () => {
    const state = { checkinStreak: 6, lastCheckinDate: day("2026-10-12") };
    expect(computeCheckin(state, day("2026-10-14"), 7, 50)).toMatchObject({ streak: 1, reward: 0 });
  });

  it("pays the reward on every multiple of the configured days", () => {
    const at = (streakBefore: number) =>
      computeCheckin({ checkinStreak: streakBefore, lastCheckinDate: day("2026-10-13") }, day("2026-10-14"), 7, 50);

    expect(at(6)).toMatchObject({ streak: 7, reward: 50 });
    expect(at(7)).toMatchObject({ streak: 8, reward: 0 });
    expect(at(13)).toMatchObject({ streak: 14, reward: 50 });
  });

  it("crosses month and year boundaries", () => {
    const state = { checkinStreak: 2, lastCheckinDate: day("2026-12-31") };
    expect(computeCheckin(state, day("2027-01-01"), 7, 50)).toMatchObject({ streak: 3 });
  });
});

describe("visibleCheckinStreak", () => {
  it("keeps the streak while today's check-in is still possible", () => {
    expect(visibleCheckinStreak({ checkinStreak: 4, lastCheckinDate: day("2026-10-13") }, day("2026-10-14"))).toBe(4);
    expect(visibleCheckinStreak({ checkinStreak: 4, lastCheckinDate: day("2026-10-14") }, day("2026-10-14"))).toBe(4);
  });

  it("shows 0 once a day was missed", () => {
    expect(visibleCheckinStreak({ checkinStreak: 4, lastCheckinDate: day("2026-10-12") }, day("2026-10-14"))).toBe(0);
  });
});

describe("dailyCheckin", () => {
  const enabled = { checkin: { enabled: true, rewardDays: 7, rewardPoints: 50 } };
  // 22h em São Paulo do dia 14 = 01h UTC do dia 15: tem que contar como dia 14.
  const lateEveningSaoPaulo = new Date("2026-10-15T01:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    settingsMock.mockResolvedValue(enabled);
  });

  it("does nothing when the admin turned check-in off", async () => {
    settingsMock.mockResolvedValue({ checkin: { enabled: false, rewardDays: 7, rewardPoints: 50 } });
    expect(await dailyCheckin("u1")).toEqual({ ok: false, reason: "desativado" });
    expect(dbMock.gamificationProfile.upsert).not.toHaveBeenCalled();
  });

  it("uses the São Paulo calendar day, not the UTC one", async () => {
    dbMock.gamificationProfile.upsert.mockResolvedValue({
      checkinStreak: 2,
      lastCheckinDate: day("2026-10-13"),
      points: 10,
      level: 1,
    });
    dbMock.gamificationProfile.updateMany.mockResolvedValue({ count: 1 });

    const result = await dailyCheckin("u1", lateEveningSaoPaulo);

    expect(result).toEqual({ ok: true, streak: 3, reward: 0, points: 10, level: 1 });
    expect(dbMock.gamificationProfile.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", lastCheckinDate: day("2026-10-13") },
      data: { checkinStreak: 3, lastCheckinDate: day("2026-10-14") },
    });
  });

  it("pays the reward and recomputes the level on the 7th day", async () => {
    dbMock.gamificationProfile.upsert.mockResolvedValue({
      checkinStreak: 6,
      lastCheckinDate: day("2026-10-13"),
      points: 120,
      level: 2,
    });
    dbMock.gamificationProfile.updateMany.mockResolvedValue({ count: 1 });
    dbMock.gamificationProfile.findUniqueOrThrow.mockResolvedValue({ points: 170 });

    const result = await dailyCheckin("u1", lateEveningSaoPaulo);

    expect(result).toEqual({ ok: true, streak: 7, reward: 50, points: 170, level: 3 });
    expect(dbMock.gamificationProfile.updateMany.mock.calls[0]![0].data).toMatchObject({
      points: { increment: 50 },
    });
    expect(dbMock.gamificationProfile.update).toHaveBeenCalledWith({ where: { userId: "u1" }, data: { level: 3 } });
  });

  it("treats a lost race (concurrent click) as already checked in", async () => {
    dbMock.gamificationProfile.upsert.mockResolvedValue({
      checkinStreak: 6,
      lastCheckinDate: day("2026-10-13"),
      points: 120,
      level: 2,
    });
    dbMock.gamificationProfile.updateMany.mockResolvedValue({ count: 0 });

    expect(await dailyCheckin("u1", lateEveningSaoPaulo)).toEqual({ ok: false, reason: "ja_fez_checkin" });
    expect(dbMock.gamificationProfile.update).not.toHaveBeenCalled();
  });
});
