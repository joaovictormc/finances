import { z } from "zod";

export const AccountTypeSchema = z.enum([
  "checking",
  "savings",
  "credit_card",
  "investment",
  "wallet",
]);

export const CreateFinancialAccountSchema = z.object({
  type: AccountTypeSchema,
  name: z.string().min(1, "Nome obrigatório").max(100),
  institution: z.string().max(100).optional(),
  currency: z.string().default("BRL"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().optional(),
  groupId: z.string().optional(),
  hasCreditCard: z.boolean().default(false),
});

export const UpdateFinancialAccountSchema =
  CreateFinancialAccountSchema.partial();

export type CreateFinancialAccount = z.infer<
  typeof CreateFinancialAccountSchema
>;
export type UpdateFinancialAccount = z.infer<
  typeof UpdateFinancialAccountSchema
>;
