import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "@finances/db";
import {
  CreateFinancialAccountSchema,
  UpdateFinancialAccountSchema,
} from "@finances/validations";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { getUserGroupIds, hasGroupRole } from "../lib/groups";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth);

app.get("/", async (c) => {
  const userId = c.get("userId");
  const groupIds = await getUserGroupIds(userId);
  const archived = c.req.query("archived") === "true";

  const accounts = await db.financialAccount.findMany({
    where: {
      isArchived: archived,
      OR: [{ userId, groupId: null }, { groupId: { in: groupIds } }],
    },
    include: {
      _count: { select: { transactions: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return c.json(accounts);
});

app.post("/", zValidator("json", CreateFinancialAccountSchema), async (c) => {
  const userId = c.get("userId");
  const data = c.req.valid("json");

  if (data.groupId && !(await hasGroupRole(userId, data.groupId, ["owner", "admin", "member"]))) {
    return c.json({ error: "Sem permissão para compartilhar com este grupo" }, 403);
  }

  const account = await db.financialAccount.create({
    data: { ...data, userId },
  });

  return c.json(account, 201);
});

app.patch("/:id", zValidator("json", UpdateFinancialAccountSchema), async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const data = c.req.valid("json");

  const existing = await db.financialAccount.findFirst({ where: { id } });
  if (!existing) return c.json({ error: "Conta não encontrada" }, 404);
  const canEdit =
    existing.userId === userId ||
    (existing.groupId && (await hasGroupRole(userId, existing.groupId, ["owner", "admin"])));
  if (!canEdit) return c.json({ error: "Conta não encontrada" }, 404);

  const account = await db.financialAccount.update({
    where: { id },
    data,
  });

  return c.json(account);
});

app.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await db.financialAccount.findFirst({ where: { id } });
  if (!existing) return c.json({ error: "Conta não encontrada" }, 404);
  const canDelete =
    existing.userId === userId ||
    (existing.groupId && (await hasGroupRole(userId, existing.groupId, ["owner", "admin"])));
  if (!canDelete) return c.json({ error: "Conta não encontrada" }, 404);

  // Soft delete via archive
  const account = await db.financialAccount.update({
    where: { id },
    data: { isArchived: true },
  });

  return c.json(account);
});

app.delete("/:id/permanent", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await db.financialAccount.findFirst({ where: { id } });
  if (!existing) return c.json({ error: "Conta não encontrada" }, 404);
  const canDelete =
    existing.userId === userId ||
    (existing.groupId && (await hasGroupRole(userId, existing.groupId, ["owner", "admin"])));
  if (!canDelete) return c.json({ error: "Conta não encontrada" }, 404);
  if (!existing.isArchived) {
    return c.json({ error: "Arquive a conta antes de excluir definitivamente" }, 400);
  }

  await db.$transaction([
    db.transaction.deleteMany({ where: { accountId: id } }),
    db.financialAccount.delete({ where: { id } }),
  ]);

  return c.json({ success: true });
});

export default app;
