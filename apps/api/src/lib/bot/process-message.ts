import { db } from "@finances/db";
import { redis } from "../redis";
import { bot } from "../../routes/bots/telegram";
import { parseExpenseMessage } from "../ai/expense-parser";
import { InlineKeyboard } from "grammy";

export async function processIncomingText(params: {
  platform: "telegram" | "whatsapp";
  platformChatId: string;
  userId: string;
  text: string;
  today: string;
  messageType?: "text" | "audio";
}): Promise<void> {
  const { platform, platformChatId, userId, text, today, messageType = "text" } = params;

  const parsed = await parseExpenseMessage(text, today);

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
      messageType,
      content: text,
      parsedIntent: parsed.intent,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parsedData: parsed as any,
      aiConfidence: parsed.confidence,
    },
  });

  if (platform === "telegram") {
    await handleTelegramParsedMessage(parseInt(platformChatId), userId, parsed, conversation.id);
  }
}

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

    await redis.setex(
      `bot:pending:${conversationId}`,
      300,
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

async function matchCategory(userId: string, hint?: string): Promise<string | null> {
  if (!hint) return null;

  const categories = await db.category.findMany({
    where: { OR: [{ isSystem: true }, { userId }] },
    select: { id: true, name: true },
  });

  const hintLower = hint.toLowerCase();
  const match = categories.find(
    (c) => c.name.toLowerCase().includes(hintLower) || hintLower.includes(c.name.toLowerCase())
  );

  return match?.id ?? null;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
