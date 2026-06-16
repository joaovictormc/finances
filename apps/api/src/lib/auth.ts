import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "@finances/db";

// O handler de auth roda na API (porta 3001), então o baseURL precisa apontar para ela.
const API_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3001";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Em desenvolvimento/testes deixamos a verificação de e-mail desligada por padrão,
// para permitir cadastro + login imediato sem depender de Brevo/Redis.
// Ative em produção com AUTH_REQUIRE_EMAIL_VERIFICATION="true".
const requireEmailVerification =
  process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === "true";

const hasGoogleOAuth =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export const auth = betterAuth({
  baseURL: API_URL,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification,
    minPasswordLength: 8,
  },
  ...(hasGoogleOAuth
    ? {
        socialProviders: {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          },
        },
      }
    : {}),
  emailVerification: {
    sendOnSignUp: requireEmailVerification,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      try {
        const { sendEmail } = await import("./email");
        await sendEmail({
          to: user.email,
          subject: "Confirme seu e-mail — Financeiro",
          template: "email-verification",
          data: { name: user.name, url },
        });
      } catch (err) {
        // Não derruba o fluxo de cadastro se o envio (Brevo/Redis) falhar.
        console.error("[auth] Falha ao enfileirar e-mail de verificação:", err);
      }
    },
  },
  databaseHooks: {
    user: {
      create: {
        // E-mail de boas-vindas logo após o cadastro. Fire-and-forget: nunca
        // bloqueia nem derruba o signup, mesmo com Redis/Brevo indisponíveis.
        after: async (user) => {
          void (async () => {
            try {
              const { sendEmail } = await import("./email");
              await sendEmail({
                to: user.email,
                subject: "Bem-vindo ao Financeiro! 💰",
                template: "welcome",
                data: { name: user.name },
              });
            } catch (err) {
              console.error("[auth] Falha ao enfileirar e-mail de boas-vindas:", err);
            }
          })();
        },
      },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // cache da sessão no cookie por 5 minutos
    },
  },
  trustedOrigins: [APP_URL, API_URL],
});

export type Auth = typeof auth;
