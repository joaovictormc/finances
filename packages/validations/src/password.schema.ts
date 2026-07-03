import { z } from "zod";

// Política de senha forte: mínimo 8 caracteres + ao menos 3 das 4 classes
// (maiúscula, minúscula, número, símbolo) — mesmo padrão usado por NIST/OWASP
// para evitar senhas triviais sem exigir símbolo obrigatório (frustra usuários).
const LOWER = /[a-z]/;
const UPPER = /[A-Z]/;
const DIGIT = /[0-9]/;
const SYMBOL = /[^a-zA-Z0-9]/;

export type PasswordStrength = "muito-fraca" | "fraca" | "media" | "forte";

export function scorePassword(password: string): { score: number; classes: number; strength: PasswordStrength } {
  const classes = [LOWER, UPPER, DIGIT, SYMBOL].filter((re) => re.test(password)).length;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  score += classes >= 3 ? 2 : classes === 2 ? 1 : 0;

  const strength: PasswordStrength = score <= 1 ? "muito-fraca" : score === 2 ? "fraca" : score === 3 ? "media" : "forte";
  return { score, classes, strength };
}

export const PasswordPolicySchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres")
  .max(128, "A senha deve ter no máximo 128 caracteres")
  .refine((pw) => [LOWER, UPPER, DIGIT, SYMBOL].filter((re) => re.test(pw)).length >= 3, {
    message: "A senha deve combinar pelo menos 3 destes: letra maiúscula, letra minúscula, número e símbolo",
  });
