import { z } from "zod";

export const TransactionTypeSchema = z.enum(["income", "expense", "transfer"]);
export const PaymentMethodSchema = z.enum(["debit", "credit", "pix", "cash", "boleto"]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

// Débito é o método implícito (padrão, sem selo); os demais aparecem como
// opção pra qualquer tipo de transação — crédito só quando a conta
// selecionada tem cartão (hasCreditCard), então fica de fora da lista base.
export const BASE_PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "debit", label: "Débito" },
  { value: "pix", label: "Pix" },
  { value: "cash", label: "Dinheiro" },
  { value: "boleto", label: "Boleto" },
];

export const PAYMENT_METHOD_BADGE: Partial<Record<PaymentMethod, string>> = {
  credit: "💳 Crédito",
  pix: "⚡ Pix",
  cash: "💵 Dinheiro",
  boleto: "🧾 Boleto",
};

export const CreateTransactionSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().optional(),
  type: TransactionTypeSchema,
  paymentMethod: PaymentMethodSchema.default("debit"),
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
  groupId: z.string().optional(),
});

export const UpdateTransactionSchema = CreateTransactionSchema.partial();

export const BulkCategorizeTransactionsSchema = z.object({
  transactionIds: z
    .array(z.string().min(1))
    .min(1, "Selecione ao menos uma transação")
    .max(100, "Selecione no máximo 100 transações")
    .refine((ids) => new Set(ids).size === ids.length, "IDs de transações duplicados"),
  categoryId: z.string().min(1, "Selecione uma categoria"),
});

export const TransactionFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  type: TransactionTypeSchema.optional(),
  categoryId: z.string().optional(),
  accountId: z.string().optional(),
  search: z.string().optional(),
  source: z.string().optional(),
  isIgnored: z.coerce.boolean().optional(),
  groupId: z.string().optional(),
});

export type CreateTransaction = z.infer<typeof CreateTransactionSchema>;
export type UpdateTransaction = z.infer<typeof UpdateTransactionSchema>;
export type BulkCategorizeTransactions = z.infer<typeof BulkCategorizeTransactionsSchema>;
export type TransactionFilters = z.infer<typeof TransactionFiltersSchema>;
