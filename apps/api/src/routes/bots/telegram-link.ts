import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@finances/db";
import { redis } from "../../lib/redis";
import { requireAuth, type AuthVariables } from "../../middleware/auth";
import { isChannelAllowed } from "../../lib/plan-limits";
import { bot } from "./telegram";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth);

// ── GET /status — a conta tem Telegram vinculado? ─────────────────────────────
app.get("/status", async (c) => {
  const userId = c.get("userId");

  const profile = await db.userProfile.findUnique({
    where: { userId },
    select: { telegramChatId: true },
  });

  return c.json({
    linked: !!profile?.telegramChatId,
    telegramChatId: profile?.telegramChatId ? profile.telegramChatId.toString() : null,
  });
});

// ── POST /link — resgata o código de 6 dígitos gerado pelo bot (/start) ────────
const LinkSchema = z.object({ code: z.string().trim().min(4).max(12) });

app.post("/link", zValidator("json", LinkSchema), async (c) => {
  const userId = c.get("userId");

  if (!(await isChannelAllowed(userId, "telegram"))) {
    return c.json(
      { error: "Integração com bot disponível nos planos Pro e Família. Faça upgrade para usar." },
      403
    );
  }

  const { code } = c.req.valid("json");
  const key = `telegram:link:${code.toUpperCase()}`;

  const telegramIdStr = await redis.get(key);
  if (!telegramIdStr) {
    return c.json(
      { error: "Código inválido ou expirado. Envie /start ao bot para gerar um novo." },
      400
    );
  }

  const telegramId = BigInt(telegramIdStr);

  // O telegramChatId é único: impede sequestrar um Telegram já vinculado a outra conta.
  const owner = await db.userProfile.findUnique({
    where: { telegramChatId: telegramId },
    select: { userId: true },
  });
  if (owner && owner.userId !== userId) {
    return c.json({ error: "Este Telegram já está vinculado a outra conta." }, 409);
  }

  await db.userProfile.upsert({
    where: { userId },
    create: { userId, telegramChatId: telegramId },
    update: { telegramChatId: telegramId },
  });

  await redis.del(key);

  // Confirmação no chat do Telegram (best-effort: não falha o link se o bot não enviar).
  try {
    await bot.api.sendMessage(
      Number(telegramId),
      "✅ Conta vinculada com sucesso! Agora é só me mandar seus gastos e receitas. Use /ajuda para ver exemplos."
    );
  } catch (err) {
    console.error("[telegram-link] não foi possível enviar confirmação:", (err as Error).message);
  }

  return c.json({ linked: true });
});

// ── DELETE /link — desvincula o Telegram da conta ─────────────────────────────
app.delete("/link", async (c) => {
  const userId = c.get("userId");

  const profile = await db.userProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (profile) {
    await db.userProfile.update({ where: { userId }, data: { telegramChatId: null } });
  }

  return c.json({ linked: false });
});

export default app;
