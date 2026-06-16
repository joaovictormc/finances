import { Bot, webhookCallback, InlineKeyboard } from "grammy";
import { db } from "@finances/db";
import { redis } from "../../lib/redis";
import { parseExpenseMessage } from "../../lib/ai/expense-parser";
import { botMessagesQueue, voiceTranscriptionQueue } from "../../jobs/queues";

// Usa "||" (não "??") para que TELEGRAM_BOT_TOKEN="" também caia no placeholder.
// grammy exige token não-vazio na instanciação; só chama o Telegram de fato no webhook.
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || "placeholder");

// ── /start — link Telegram account to web app ────────────────────────────────
bot.command("start", async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  // Check if already linked
  const profile = await db.userProfile.findUnique({
    where: { telegramChatId: BigInt(telegramId) },
    include: { user: { select: { name: true } } },
  });

  if (profile) {
    return ctx.reply(
      `Olá, ${profile.user.name}! 👋 Sua conta já está vinculada.\n\nManda um gasto ou receita pra eu registrar, ou use /ajuda pra ver o que posso fazer.`
    );
  }

  // Generate one-time linking code
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  await redis.setex(`telegram:link:${code}`, 600, telegramId.toString()); // 10min TTL

  return ctx.reply(
    `Olá! 👋 Para vincular sua conta, acesse o app e insira este código:\n\n` +
      `🔑 <b>${code}</b>\n\n` +
      `O código expira em 10 minutos.`,
    { parse_mode: "HTML" }
  );
});

// ── /ajuda ────────────────────────────────────────────────────────────────────
bot.command("ajuda", async (ctx) => {
  return ctx.reply(
    `🤖 *O que posso fazer por você:*\n\n` +
      `💸 *Registrar gastos:*\n` +
      `"gastei 50 no mercado"\n` +
      `"paguei 89,90 no spotify"\n` +
      `"uber 23 conto"\n\n` +
      `💰 *Registrar receitas:*\n` +
      `"recebi salário de 3200"\n` +
      `"freelance 500 reais"\n\n` +
      `📊 *Consultas:*\n` +
      `"quanto gastei essa semana?"\n` +
      `"qual meu saldo?"\n` +
      `"/resumo" — resumo do mês\n\n` +
      `🎤 *Ou manda um áudio!* Também entendo mensagens de voz.`,
    { parse_mode: "Markdown" }
  );
});

// ── /resumo — monthly summary ─────────────────────────────────────────────────
bot.command("resumo", async (ctx) => {
  const userId = await resolveUserByTelegramId(ctx.from?.id);
  if (!userId) return sendLinkPrompt(ctx);

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [income, expense] = await Promise.all([
    db.transaction.aggregate({
      where: { userId, type: "income", date: { gte: startDate, lte: endDate }, isIgnored: false },
      _sum: { amount: true },
    }),
    db.transaction.aggregate({
      where: { userId, type: "expense", date: { gte: startDate, lte: endDate }, isIgnored: false },
      _sum: { amount: true },
    }),
  ]);

  const incomeVal = Number(income._sum.amount ?? 0);
  const expenseVal = Number(expense._sum.amount ?? 0);
  const balance = incomeVal - expenseVal;

  const monthName = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return ctx.reply(
    `📊 *Resumo de ${monthName}*\n\n` +
      `💚 Receitas: *${formatBRL(incomeVal)}*\n` +
      `❤️ Gastos: *${formatBRL(expenseVal)}*\n` +
      `${balance >= 0 ? "💙" : "🟠"} Saldo: *${formatBRL(balance)}*`,
    { parse_mode: "Markdown" }
  );
});

// ── Text messages — NLP parsing ───────────────────────────────────────────────
bot.on("message:text", async (ctx) => {
  const telegramId = ctx.from?.id;
  const userId = await resolveUserByTelegramId(telegramId);

  if (!userId) return sendLinkPrompt(ctx);

  // Enqueue for async processing (keeps response under 5s)
  await botMessagesQueue.add("parse-message", {
    platform: "telegram",
    platformChatId: ctx.chat.id.toString(),
    userId,
    text: ctx.message.text,
    messageId: ctx.message.message_id,
    today: new Date().toISOString().split("T")[0],
  });

  // Send immediate acknowledgment for slow connections
  // (the worker will send the actual response)
});

// ── Voice messages ────────────────────────────────────────────────────────────
bot.on("message:voice", async (ctx) => {
  const telegramId = ctx.from?.id;
  const userId = await resolveUserByTelegramId(telegramId);

  if (!userId) return sendLinkPrompt(ctx);

  await ctx.reply("🎤 Processando seu áudio...");

  await voiceTranscriptionQueue.add("transcribe", {
    platform: "telegram",
    platformChatId: ctx.chat.id.toString(),
    userId,
    fileId: ctx.message.voice.file_id,
    duration: ctx.message.voice.duration,
    today: new Date().toISOString().split("T")[0],
  });
});

// ── Callback queries (inline keyboard buttons) ────────────────────────────────
bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;
  const userId = await resolveUserByTelegramId(ctx.from.id);
  if (!userId) return ctx.answerCallbackQuery();

  await botMessagesQueue.add("handle-callback", {
    platform: "telegram",
    platformChatId: ctx.chat?.id.toString() ?? ctx.from.id.toString(),
    userId,
    callbackData: data,
    today: new Date().toISOString().split("T")[0],
  });

  await ctx.answerCallbackQuery();
});

// ── Helpers ───────────────────────────────────────────────────────────────────
async function resolveUserByTelegramId(telegramId?: number): Promise<string | null> {
  if (!telegramId) return null;
  const profile = await db.userProfile.findUnique({
    where: { telegramChatId: BigInt(telegramId) },
    select: { userId: true },
  });
  return profile?.userId ?? null;
}

async function sendLinkPrompt(ctx: { reply: (text: string, opts?: object) => Promise<unknown> }) {
  return ctx.reply(
    '👋 Para usar o bot, primeiro vincule sua conta em nosso app com o comando /start'
  );
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export const telegramWebhookHandler = webhookCallback(bot, "hono");
export { bot };
