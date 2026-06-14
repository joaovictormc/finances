import { Worker, type Job } from "bullmq";
import { redis } from "../../lib/redis";
import { db } from "@finances/db";
import { parseExpenseMessage } from "../../lib/ai/expense-parser";
import { bot } from "../../routes/bots/telegram";
import { InlineKeyboard } from "grammy";

type BotMessageJob = {
  platform: "telegram" | "whatsapp";
  platformChatId: string;
  userId: string;
  text?: string;
  callbackData?: string;
  today: string;
};

export const botMessagesWorker = new Worker<BotMessageJob>(
  "bot-messages",
  async (job: Job<BotMessageJob>) => {
    const { platform, platformChatId, userId, text, callbackData, today } = job.data;

    if (callbackData) {
      await handleCallback({ platform, platformChatId, userId, callbackData });
      return;
    }

    if (!text) return;

    const chatId = parseInt(platformChatId);

    // Parse with Claude Haiku
    const parsed = await parseExpenseMessage(text, today);

    // Log the message
    let conversation = await db.botConversation.findUnique({
      where: { platform_platformChatId: { platform, platformChatId } },
    });
    if (!conversation) {
      conversation = await db.botConversation.create({
        data: { userId, platform, platformChatId },
      });
    }

    await db.botMessage.create({
      data: {
        conversationId: conversation.id,
        direction: "inbound",
        messageType: "text",
        content: text,
        parsedIntent: parsed.intent,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parsedData: parsed as any,
        aiConfidence: parsed.confidence,
      },
    });

    if (platform === "telegram") {
      await handleTelegramParsedMessage(chatId, userId, parsed, conversation.id);
    }
  },
  { connection: redis, concurrency: 10 }
);

async function handleTelegramParsedMessage(
  chatId: number,
  userId: string,
  parsed: Awaited<ReturnType<typeof parseExpenseMessage>>,
  conversationId: string
) {
  if (parsed.confidence < 0.7) {
    await bot.api.sendMessage(
      chatId,
      "🤔 Não entendi bem. Tente algo como:\n• \"gastei 50 no mercado\"\n• \"recebi salário de 3200\"\n• \"quanto gastei essa semana?\""
    );
    return;
  }

  if (parsed.intent === "record_expense" || parsed.intent === "record_income") {
    // Find best matching category
    const categoryId = await matchCategory(userId, parsed.categoryHint);

    const dateStr = parsed.date ?? new Date().toISOString().split("T")[0];
    const amountBRL = formatBRL(parsed.amount ?? 0);
    const categoryName = categoryId
      ? (await db.category.findUnique({ where: { id: categoryId } }))?.name ?? "Sem categoria"
      : "Sem categoria";

    const keyboard = new InlineKeyboard()
      .text("✅ Confirmar", `confirm:${conversationId}`)
      .text("✏️ Editar", `edit:${conversationId}`)
      .row()
      .text("❌ Cancelar", `cancel:${conversationId}`);

    const typeEmoji = parsed.intent === "record_expense" ? "💸" : "💰";
    const typeLabel = parsed.intent === "record_expense" ? "Gasto" : "Receita";

    // Store pending transaction in Redis for confirmation
    await redis.setex(
      `bot:pending:${conversationId}`,
      300, // 5min
      JSON.stringify({
        type: parsed.intent === "record_expense" ? "expense" : "income",
        amount: parsed.amount,
        description: parsed.description ?? categoryName,
        categoryId,
        date: dateStr,
        userId,
      })
    );

    await bot.api.sendMessage(
      chatId,
      `${typeEmoji} *${typeLabel} detectado:*\n\n` +
        `💵 Valor: *${amountBRL}*\n` +
        `📁 Categoria: *${categoryName}*\n` +
        `📅 Data: *${new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR")}*` +
        (parsed.description ? `\n📝 Descrição: ${parsed.description}` : ""),
      { parse_mode: "Markdown", reply_markup: keyboard }
    );
  } else if (parsed.intent === "monthly_summary" || parsed.intent === "list_balance") {
    await bot.api.sendMessage(chatId, "Use /resumo para ver o resumo do mês.");
  } else {
    await bot.api.sendMessage(
      chatId,
      "Não entendi. Tente descrever um gasto ou receita, ou use /ajuda."
    );
  }
}

async function handleCallback(data: {
  platform: string;
  platformChatId: string;
  userId: string;
  callbackData: string;
}) {
  const [action, conversationId] = data.callbackData.split(":");
  if (!action || !conversationId) return;

  if (data.platform !== "telegram") return;
  const chatId = parseInt(data.platformChatId);

  if (action === "confirm") {
    const pendingStr = await redis.get(`bot:pending:${conversationId}`);
    if (!pendingStr) {
      await bot.api.sendMessage(chatId, "⚠️ Tempo expirado. Envie a mensagem novamente.");
      return;
    }

    const pending = JSON.parse(pendingStr) as {
      type: "expense" | "income";
      amount: number;
      description: string;
      categoryId: string | null;
      date: string;
      userId: string;
    };

    // Find default account for user
    const defaultAccount = await db.financialAccount.findFirst({
      where: { userId: pending.userId, isArchived: false },
      orderBy: { createdAt: "asc" },
    });

    if (!defaultAccount) {
      await bot.api.sendMessage(
        chatId,
        "⚠️ Você precisa cadastrar uma conta no app antes de registrar transações."
      );
      return;
    }

    const transaction = await db.transaction.create({
      data: {
        userId: pending.userId,
        accountId: defaultAccount.id,
        categoryId: pending.categoryId,
        type: pending.type,
        amount: pending.amount,
        description: pending.description,
        date: new Date(pending.date),
        source: "telegram",
      },
    });

    await db.botMessage.updateMany({
      where: { conversationId },
      data: { resultedInTransactionId: transaction.id },
    });

    await redis.del(`bot:pending:${conversationId}`);
    await bot.api.sendMessage(
      chatId,
      `✅ *${pending.type === "expense" ? "Gasto" : "Receita"} registrado!*\n${formatBRL(pending.amount)} em ${pending.description}`,
      { parse_mode: "Markdown" }
    );
  } else if (action === "cancel") {
    await redis.del(`bot:pending:${conversationId}`);
    await bot.api.sendMessage(chatId, "❌ Cancelado.");
  }
}

async function matchCategory(userId: string, hint?: string): Promise<string | null> {
  if (!hint) return null;

  const categories = await db.category.findMany({
    where: { OR: [{ isSystem: true }, { userId }] },
    select: { id: true, name: true },
  });

  const hintLower = hint.toLowerCase();
  const match = categories.find((c) =>
    c.name.toLowerCase().includes(hintLower) ||
    hintLower.includes(c.name.toLowerCase())
  );

  return match?.id ?? null;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

botMessagesWorker.on("failed", (job, err) => {
  console.error(`[bot-messages] Job ${job?.id} failed:`, err.message);
});
