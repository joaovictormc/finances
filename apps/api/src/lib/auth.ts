import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer } from "better-auth/plugins/bearer";
import { db } from "@finances/db";

// O handler de auth roda na API (porta 3001), então o baseURL precisa apontar para ela.
const API_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3001";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const EXPO_URL = process.env.EXPO_URL ?? "http://localhost:8081";
// Origens de LAN usadas pelo app nativo (Expo Go no celular) ao falar com a API.
// Em dev o telefone alcança a API pelo IP da máquina, não por localhost.
const LAN_ORIGINS = (process.env.LAN_ORIGINS ?? "http://192.168.100.93:3001,http://192.168.100.17:3001")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

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
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "user", input: false },
    },
  },
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
          subject: "Confirme seu e-mail — ControlAI",
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
                subject: "Bem-vindo ao ControlAI! 💰",
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
  trustedOrigins: [APP_URL, API_URL, EXPO_URL, ...LAN_ORIGINS, "controlai://"],
  // bearer: permite autenticar via header "Authorization: Bearer <token>",
  // usado pelo app mobile (sem cookie jar confiável) — coexiste com o cookie do web.
  // (o plugin server-side "expo" de @better-auth/expo não foi adicionado: ele traz
  // zod v4 como dependência direta, conflitando com o zod v3 do projeto e quebrando
  // a inferência de tipo de `auth` — TS2742. Só é necessário pra OAuth/deep-link no
  // mobile, fora de escopo desta fase.)
  plugins: [bearer()],
});

export type Auth = typeof auth;
