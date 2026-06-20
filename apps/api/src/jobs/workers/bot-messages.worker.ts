import { Worker, type Job } from "bullmq";
import { redis } from "../../lib/redis";
import { db } from "@finances/db";
import { bot } from "../../routes/bots/telegram";
import { processIncomingText } from "../../lib/bot/process-message";

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

    await processIncomingText({ platform, platformChatId, userId, text, today, messageType: "text" });
  },
  { connection: redis, concurrency: 10 }
);

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
  } else if (action === "edit") {
    await redis.del(`bot:pending:${conversationId}`);
    await bot.api.sendMessage(
      chatId,
      "✏️ Sem problema! Envie novamente a mensagem com os dados corretos.\nEx: \"na verdade foi 60 reais em transporte\""
    );
  }
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

botMessagesWorker.on("failed", (job, err) => {
  console.error(`[bot-messages] Job ${job?.id} failed:`, err.message);
});
