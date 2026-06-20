import { z } from "zod";

export const BudgetPeriodSchema = z.enum(["weekly", "monthly", "yearly"]);

export const CreateBudgetSchema = z.object({
  categoryId: z.string().optional(),
  name: z.string().min(1, "Nome obrigatório").max(100),
  amount: z.number().positive("Valor deve ser positivo"),
  period: BudgetPeriodSchema.default("monthly"),
  startDate: z.string().date("Data inválida"),
  endDate: z.string().date().optional(),
  alertThreshold: z.number().min(0).max(1).default(0.8),
  groupId: z.string().optional(),
});

export const UpdateBudgetSchema = CreateBudgetSchema.partial();

export type CreateBudget = z.infer<typeof CreateBudgetSchema>;
export type UpdateBudget = z.infer<typeof UpdateBudgetSchema>;
