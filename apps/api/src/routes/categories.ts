import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "@finances/db";
import { CreateCategorySchema, UpdateCategorySchema } from "@finances/validations";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { createUserCategory, deleteUserCategory, updateUserCategory } from "../lib/categories";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth);

app.get("/", async (c) => {
  const userId = c.get("userId");
  const { type } = c.req.query();

  const categories = await db.category.findMany({
    where: {
      OR: [{ isSystem: true }, { userId }],
      parentId: null,
      ...(type && { type }),
    },
    include: {
      children: {
        where: { OR: [{ isSystem: true }, { userId }] },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return c.json(categories);
});

app.post("/", zValidator("json", CreateCategorySchema), async (c) => {
  const userId = c.get("userId");
  const result = await createUserCategory(userId, c.req.valid("json"));

  if (!result.ok) {
    const messages = {
      mae_invalida: "Categoria principal inválida para este tipo.",
      nome_duplicado: "Já existe uma categoria com esse nome.",
    };
    return c.json({ error: messages[result.reason] }, result.reason === "nome_duplicado" ? 409 : 400);
  }
  return c.json(result.category, 201);
});

app.patch("/:id", zValidator("json", UpdateCategorySchema), async (c) => {
  const userId = c.get("userId");
  const result = await updateUserCategory(userId, c.req.param("id"), c.req.valid("json"));

  if (!result.ok) {
    if (result.reason === "nao_encontrada") {
      return c.json({ error: "Categoria não encontrada ou não pode ser editada." }, 404);
    }
    return c.json({ error: "Já existe uma categoria com esse nome." }, 409);
  }
  return c.json(result.category);
});

app.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const result = await deleteUserCategory(userId, c.req.param("id"));

  if (!result.ok) {
    const n = result.count ?? 0;
    const messages = {
      nao_encontrada: "Categoria não encontrada ou não pode ser excluída.",
      tem_subcategorias: `Esta categoria tem ${n} subcategoria${n === 1 ? "" : "s"}. Exclua-as antes.`,
      usada_em_orcamento: `Esta categoria está em ${n} orçamento${n === 1 ? "" : "s"}. Remova ou troque a categoria do orçamento antes de excluir.`,
    };
    return c.json({ error: messages[result.reason] }, result.reason === "nao_encontrada" ? 404 : 409);
  }
  return c.json(result);
});

export default app;
