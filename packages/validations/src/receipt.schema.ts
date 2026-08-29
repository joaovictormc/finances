import { z } from "zod";

// Saída estruturada do modelo de visão da Groq ao interpretar uma foto de
// cupom fiscal/nota de cartão/NF-e — nunca cria a transação sozinho, só
// pré-preenche o formulário pro usuário revisar e confirmar.
export const ParsedReceiptSchema = z.object({
  merchant: z.string().optional(), // nome do estabelecimento
  amount: z.number().positive().optional(), // valor total, em reais
  date: z.string().date().optional(), // ISO date string
  categoryHint: z.string().optional(), // ex: "supermercado", "restaurante"
  items: z
    .array(
      z.object({
        description: z.string(),
        amount: z.number().optional(),
      })
    )
    .optional(),
  confidence: z.number().min(0).max(1),
});

export type ParsedReceipt = z.infer<typeof ParsedReceiptSchema>;
