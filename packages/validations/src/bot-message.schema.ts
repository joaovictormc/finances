import { z } from "zod";

// Parsed output from the Claude NLP expense parser
export const ParsedExpenseSchema = z.object({
  intent: z.enum([
    "record_expense",
    "record_income",
    "query",
    "list_balance",
    "monthly_summary",
    "unknown",
  ]),
  amount: z.number().positive().optional(),
  currency: z.string().default("BRL"),
  description: z.string().optional(),
  categoryHint: z.string().optional(), // e.g. "supermercado", "uber"
  date: z.string().date().optional(), // ISO date string
  confidence: z.number().min(0).max(1),
  rawText: z.string(),
  // For query intent
  queryType: z
    .enum([
      "spending_by_category",
      "spending_by_period",
      "account_balance",
      "general",
    ])
    .optional(),
  queryParams: z.record(z.string()).optional(),
});

export type ParsedExpense = z.infer<typeof ParsedExpenseSchema>;

// Telegram webhook update (simplified subset of the Telegram API)
export const TelegramUpdateSchema = z.object({
  update_id: z.number(),
  message: z
    .object({
      message_id: z.number(),
      from: z.object({
        id: z.number(),
        is_bot: z.boolean(),
        first_name: z.string(),
        username: z.string().optional(),
        language_code: z.string().optional(),
      }),
      chat: z.object({
        id: z.number(),
        type: z.string(),
      }),
      date: z.number(),
      text: z.string().optional(),
      voice: z
        .object({
          file_id: z.string(),
          duration: z.number(),
          mime_type: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  callback_query: z
    .object({
      id: z.string(),
      from: z.object({ id: z.number(), first_name: z.string() }),
      data: z.string().optional(),
    })
    .optional(),
});

export type TelegramUpdate = z.infer<typeof TelegramUpdateSchema>;
