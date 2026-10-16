import { z } from "zod";

/** Data ISO (YYYY-MM-DD) ou vazio = sem data. */
const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Data inválida")
  .optional()
  .nullable();

export const CouponCodeSchema = z
  .string()
  .trim()
  .min(3, "Use pelo menos 3 caracteres")
  .max(30)
  .transform((v) => v.toUpperCase())
  .refine((v) => /^[A-Z0-9_-]+$/.test(v), "Use só letras, números, - e _");

export const PAID_PLAN_IDS = ["pro", "familia"] as const;

export const CouponInputSchema = z
  .object({
    code: CouponCodeSchema,
    description: z.string().trim().max(200).default(""),
    discountType: z.enum(["percent", "fixed"]),
    percentOff: z.number().int().min(1, "Mínimo 1%").max(100, "Máximo 100%").nullable().optional(),
    amountOffCents: z.number().int().positive("Desconto precisa ser maior que zero").nullable().optional(),
    /** Vazio = vale para todos os planos pagos. */
    plans: z.array(z.enum(PAID_PLAN_IDS)).default([]),
    startsAt: optionalDate,
    expiresAt: optionalDate,
    maxRedemptions: z.number().int().positive("Use um número maior que zero").nullable().optional(),
    active: z.boolean().default(true),
  })
  .superRefine((c, ctx) => {
    if (c.discountType === "percent" && !c.percentOff) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["percentOff"], message: "Informe a porcentagem" });
    }
    if (c.discountType === "fixed" && !c.amountOffCents) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amountOffCents"], message: "Informe o valor do desconto" });
    }
    if (c.startsAt && c.expiresAt && Date.parse(c.expiresAt) <= Date.parse(c.startsAt)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expiresAt"], message: "O fim precisa ser depois do início" });
    }
  });

export const CouponPreviewSchema = z.object({
  code: CouponCodeSchema,
  plan: z.enum(PAID_PLAN_IDS),
  interval: z.enum(["monthly", "semiannual", "annual"]).default("monthly"),
});

export const REFERRAL_FREE_REWARD_TYPES = ["plan_days", "points", "none"] as const;

export const ReferralRuleInputSchema = z
  .object({
    name: z.string().trim().min(1, "Dê um nome à campanha").max(80),
    startsAt: optionalDate,
    endsAt: optionalDate,
    active: z.boolean().default(true),
    paidReferrerDays: z.number().int().min(0).max(365),
    freeRewardType: z.enum(REFERRAL_FREE_REWARD_TYPES),
    freeRewardPlan: z.enum(PAID_PLAN_IDS).default("pro"),
    freeRewardDays: z.number().int().min(0).max(365).default(0),
    freeRewardPoints: z.number().int().min(0).max(100000).default(0),
  })
  .superRefine((r, ctx) => {
    if (r.startsAt && r.endsAt && Date.parse(r.endsAt) <= Date.parse(r.startsAt)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "O fim precisa ser depois do início" });
    }
    if (r.freeRewardType === "plan_days" && r.freeRewardDays <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["freeRewardDays"], message: "Informe quantos dias" });
    }
    if (r.freeRewardType === "points" && r.freeRewardPoints <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["freeRewardPoints"], message: "Informe quantos pontos" });
    }
  });

export type CouponInput = z.infer<typeof CouponInputSchema>;
export type ReferralRuleInput = z.infer<typeof ReferralRuleInputSchema>;
