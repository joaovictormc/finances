import { createMiddleware } from "hono/factory";
import { PasswordPolicySchema } from "@finances/validations";

// Intercepta as rotas do better-auth que definem/alteram senha antes do
// handler interno. O better-auth não expõe um hook de complexidade de senha
// tipado de forma portável (minPasswordLength cobre só o tamanho), então a
// validação de força fica aqui, na borda — mesmo shape de erro que o
// better-auth usa ({ message, code }, 400) pra o authClient tratar igual.
const PASSWORD_FIELD_BY_PATH: Record<string, "password" | "newPassword"> = {
  "/api/auth/sign-up/email": "password",
  "/api/auth/reset-password": "newPassword",
  "/api/auth/change-password": "newPassword",
};

export const enforcePasswordPolicy = createMiddleware(async (c, next) => {
  const field = PASSWORD_FIELD_BY_PATH[c.req.path];
  if (!field || c.req.method !== "POST") {
    await next();
    return;
  }

  // Lê via clone() pra não consumir o stream do body — o handler do
  // better-auth (mais adiante na cadeia) ainda precisa lê-lo por inteiro.
  const body = await c.req.raw.clone().json().catch(() => null);
  const password = body?.[field];
  if (typeof password !== "string") {
    await next();
    return;
  }

  const result = PasswordPolicySchema.safeParse(password);
  if (!result.success) {
    return c.json(
      { message: result.error.issues[0]?.message ?? "Senha não atende à política de segurança.", code: "WEAK_PASSWORD" },
      400
    );
  }

  await next();
});
