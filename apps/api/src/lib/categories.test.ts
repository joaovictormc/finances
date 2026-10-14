import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  category: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    delete: vi.fn(),
  },
  budget: { count: vi.fn() },
  transaction: { updateMany: vi.fn() },
  recurringBill: { updateMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@finances/db", () => ({ db: dbMock, Prisma: {} }));

import { createUserCategory, deleteUserCategory, updateUserCategory } from "./categories";

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.category.create.mockImplementation(({ data }) => Promise.resolve({ id: "new", ...data }));
});

describe("createUserCategory", () => {
  it("creates a top-level category owned by the user", async () => {
    dbMock.category.findFirst.mockResolvedValue(null); // nome livre

    const result = await createUserCategory("u1", { name: "Pets", type: "expense", icon: "🐶" });

    expect(result.ok).toBe(true);
    expect(dbMock.category.create.mock.calls[0]![0].data).toMatchObject({
      userId: "u1",
      name: "Pets",
      type: "expense",
      icon: "🐶",
      parentId: null,
      isSystem: false,
    });
  });

  it("refuses a name already visible at the same level (system included, case-insensitive)", async () => {
    dbMock.category.findFirst.mockResolvedValue({ id: "sys-alimentacao" });

    expect(await createUserCategory("u1", { name: "alimentação", type: "expense" })).toEqual({
      ok: false,
      reason: "nome_duplicado",
    });
    expect(dbMock.category.findFirst.mock.calls[0]![0].where).toMatchObject({
      OR: [{ isSystem: true }, { userId: "u1" }],
      type: "expense",
      parentId: null,
      name: { equals: "alimentação", mode: "insensitive" },
    });
    expect(dbMock.category.create).not.toHaveBeenCalled();
  });

  it("creates a subcategory under a system parent of the same type", async () => {
    dbMock.category.findFirst
      .mockResolvedValueOnce({ id: "p1", name: "Alimentação", type: "expense", parentId: null })
      .mockResolvedValueOnce(null);

    const result = await createUserCategory("u1", { name: "Feira", type: "expense", parentId: "p1" });

    expect(result.ok).toBe(true);
    expect(dbMock.category.create.mock.calls[0]![0].data.parentId).toBe("p1");
  });

  it.each([
    ["missing or someone else's", null],
    ["of another type", { id: "p1", name: "Salário", type: "income", parentId: null }],
    ["already a subcategory (third level)", { id: "p2", name: "Mercado", type: "expense", parentId: "p1" }],
  ])("refuses a parent that is %s", async (_, parent) => {
    dbMock.category.findFirst.mockResolvedValueOnce(parent);

    expect(await createUserCategory("u1", { name: "X", type: "expense", parentId: "p1" })).toEqual({
      ok: false,
      reason: "mae_invalida",
    });
  });
});

describe("updateUserCategory", () => {
  it("does not touch system or foreign categories", async () => {
    dbMock.category.findFirst.mockResolvedValue(null);

    expect(await updateUserCategory("u1", "sys", { name: "Novo" })).toEqual({ ok: false, reason: "nao_encontrada" });
    expect(dbMock.category.findFirst.mock.calls[0]![0].where).toEqual({ id: "sys", userId: "u1", isSystem: false });
    expect(dbMock.category.update).not.toHaveBeenCalled();
  });

  it("checks the new name against siblings, ignoring itself", async () => {
    dbMock.category.findFirst
      .mockResolvedValueOnce({ id: "c1", name: "Pets", type: "expense", parentId: null })
      .mockResolvedValueOnce(null);
    dbMock.category.update.mockResolvedValue({ id: "c1", name: "Animais" });

    expect((await updateUserCategory("u1", "c1", { name: "Animais" })).ok).toBe(true);
    expect(dbMock.category.findFirst.mock.calls[1]![0].where.id).toEqual({ not: "c1" });
  });
});

describe("deleteUserCategory", () => {
  beforeEach(() => {
    dbMock.category.findFirst.mockResolvedValue({ id: "c1" });
    dbMock.category.count.mockResolvedValue(0);
    dbMock.budget.count.mockResolvedValue(0);
    dbMock.$transaction.mockResolvedValue([{ count: 3 }, { count: 1 }, {}]);
  });

  it("uncategorizes transactions and bills, then deletes", async () => {
    expect(await deleteUserCategory("u1", "c1")).toEqual({ ok: true, uncategorizedTransactions: 3 });
    expect(dbMock.transaction.updateMany).toHaveBeenCalledWith({ where: { categoryId: "c1" }, data: { categoryId: null } });
    expect(dbMock.recurringBill.updateMany).toHaveBeenCalledWith({
      where: { categoryId: "c1" },
      data: { categoryId: null },
    });
  });

  it("refuses while a budget uses the category", async () => {
    dbMock.budget.count.mockResolvedValue(2);

    expect(await deleteUserCategory("u1", "c1")).toEqual({ ok: false, reason: "usada_em_orcamento", count: 2 });
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });

  it("refuses while it still has subcategories", async () => {
    dbMock.category.count.mockResolvedValue(1);

    expect(await deleteUserCategory("u1", "c1")).toEqual({ ok: false, reason: "tem_subcategorias", count: 1 });
  });

  it("does not delete system or foreign categories", async () => {
    dbMock.category.findFirst.mockResolvedValue(null);

    expect(await deleteUserCategory("u1", "sys")).toEqual({ ok: false, reason: "nao_encontrada" });
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });
});
