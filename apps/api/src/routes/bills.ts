import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@finances/db";
import { requireAuth, type AuthVariables } from "../middleware/auth";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth);

const CreateBillSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(100),
  expectedAmount: z.number().positive().optional(),
  frequency: z.enum(["monthly", "weekly", "annual", "custom"]).default("monthly"),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  nextDueDate: z.string().date().optional(),
  merchantPattern: z.string().optional(),
  categoryId: z.string().optional(),
  accountId: z.string().optional(),
});

const UpdateBillSchema = CreateBillSchema.partial().extend({
  isActive: z.boolean().optional(),
});

app.get("/", async (c) => {
  const userId = c.get("userId");

  const bills = await db.recurringBill.findMany({
    where: { userId },
    include: {
      category: { select: { id: true, name: true, icon: true } },
    },
    orderBy: [{ isActive: "desc" }, { nextDueDate: "asc" }],
  });

  return c.json(bills);
});

app.post("/", zValidator("json", CreateBillSchema), async (c) => {
  const userId = c.get("userId");
  const data = c.req.valid("json");

  const bill = await db.recurringBill.create({
    data: {
      ...data,
      userId,
      ...(data.nextDueDate && { nextDueDate: new Date(data.nextDueDate) }),
    },
    include: {
      category: { select: { id: true, name: true, icon: true } },
    },
  });

  return c.json(bill, 201);
});

app.patch("/:id", zValidator("json", UpdateBillSchema), async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const data = c.req.valid("json");

  const existing = await db.recurringBill.findFirst({ where: { id, userId } });
  if (!existing) return c.json({ error: "Conta não encontrada" }, 404);

  const bill = await db.recurringBill.update({
    where: { id },
    data: {
      ...data,
      ...(data.nextDueDate && { nextDueDate: new Date(data.nextDueDate) }),
    },
    include: {
      category: { select: { id: true, name: true, icon: true } },
    },
  });

  return c.json(bill);
});

app.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await db.recurringBill.findFirst({ where: { id, userId } });
  if (!existing) return c.json({ error: "Conta não encontrada" }, 404);

  await db.recurringBill.delete({ where: { id } });
  return c.json({ success: true });
});

export default app;
