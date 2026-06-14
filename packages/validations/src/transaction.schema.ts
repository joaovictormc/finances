import { z } from "zod";

export const TransactionTypeSchema = z.enum(["income", "expense", "transfer"]);

export const CreateTransactionSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().optional(),
  type: TransactionTypeSchema,
  amount: z
    .number()
    .positive("Valor deve ser positivo")
    .max(999_999_999, "Valor muito alto"),
  currency: z.string().default("BRL"),
  description: z.string().min(1, "Descrição obrigatória").max(255),
  notes: z.string().max(1000).optional(),
  date: z.string().date("Data inválida"),
  source: z
    .enum(["manual", "open_finance", "telegram", "whatsapp", "import"])
    .default("manual"),
  transferPairId: z.string().optional(),
  recurringBillId: z.string().optional(),
  isIgnored: z.boolean().default(false),
});

export const UpdateTransactionSchema = CreateTransactionSchema.partial();

export const TransactionFiltersSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  type: TransactionTypeSchema.optional(),
  categoryId: z.string().optional(),
  accountId: z.string().optional(),
  search: z.string().optional(),
  source: z.string().optional(),
  isIgnored: z.boolean().optional(),
});

export type CreateTransaction = z.infer<typeof CreateTransactionSchema>;
export type UpdateTransaction = z.infer<typeof UpdateTransactionSchema>;
export type TransactionFilters = z.infer<typeof TransactionFiltersSchema>;
