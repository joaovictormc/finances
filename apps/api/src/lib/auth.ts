import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer } from "better-auth/plugins/bearer";
import { twoFactor } from "better-auth/plugins/two-factor";
import { APIError } from "better-auth/api";
import { MIN_PASSWORD_LENGTH } from "@finances/validations";
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

const betterAuthResult = betterAuth({
  baseURL: API_URL,
  database: prismaAdapter(db, { provider: "postgresql" }),
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "user", input: false },
    },
    deleteUser: {
      enabled: true,
      // Bloqueia a exclusão se o usuário for dono de algum grupo compartilhado —
      // sem isso, o grupo ficaria "órfão" (a relação Group.owner não tem
      // onDelete: Cascade/SetNull definido). O usuário precisa excluir ou
      // transferir o grupo pela tela de Grupos antes de excluir a conta.
      beforeDelete: async (user) => {
        const ownedGroups = await db.group.count({ where: { ownerId: user.id } });
        if (ownedGroups > 0) {
          throw new APIError("BAD_REQUEST", {
            message:
              "Você é dono de um ou mais grupos compartilhados. Exclua ou transfira esses grupos antes de excluir sua conta.",
          });
        }
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    // Redefinição de senha por e-mail. Revoga as outras sessões ativas ao
    // trocar a senha — se alguém pediu reset é porque a senha antiga pode
    // estar comprometida, então desloga os outros dispositivos por segurança.
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      try {
        const { sendEmail } = await import("./email");
        await sendEmail({
          to: user.email,
          subject: "Redefinir senha — ControlAI",
          template: "reset-password",
          data: { name: user.name, url },
        });
      } catch (err) {
        console.error("[auth] Falha ao enfileirar e-mail de redefinição de senha:", err);
      }
    },
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
    // Expiração absoluta de 30 dias: disableSessionRefresh faz o expiresIn
    // NÃO deslizar com o uso (o default do better-auth renovaria a sessão a
    // cada acesso via updateAge). Passados 30 dias da criação da sessão, ela
    // expira de verdade e o usuário precisa logar de novo — o que, com 2FA
    // ativado e sem "lembrar este dispositivo" (nunca usamos trustDevice nas
    // chamadas de verifyTotp/verifyBackupCode), também exige o código do
    // autenticador de novo. Vale igual pra web e mobile, é config de servidor.
    expiresIn: 60 * 60 * 24 * 30,
    disableSessionRefresh: true,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // cache da sessão no cookie por 5 minutos
    },
  },
  // secure/httpOnly/sameSite já eram os defaults implícitos do better-auth.
  // useSecureCookies fica atrelado ao protocolo real da baseURL (em vez de
  // NODE_ENV === "production") porque nada no deploy desta API garante essa
  // env var — se ficar sem setar, um NODE_ENV !== "production" em HTTPS
  // derrubaria o Secure do cookie de sessão silenciosamente.
  advanced: {
    useSecureCookies: API_URL.startsWith("https://"),
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
    },
  },
  // Antes ficava implícito em "habilitado só em produção" (default do
  // better-auth). Agora é explícito e sempre ligado, com um teto geral pros
  // endpoints de /api/auth/*. As regras mais rígidas de cadastro/reset de
  // senha (3 tentativas por 10-60s) já vêm embutidas no better-auth e
  // continuam valendo por cima deste teto geral. O login (/sign-in/email)
  // ganha uma regra própria um pouco mais generosa — o default embutido (3
  // tentativas/10s) derrubava o login com "Too many requests" silencioso em
  // uso real (typo de senha, testar 2FA). customRules SUBSTITUI a regra
  // embutida em vez de somar a ela (confirmado lendo resolveRateLimitConfig
  // do better-auth), então o valor aqui precisa continuar sendo, por si só,
  // uma proteção séria contra força bruta — não só "generoso o bastante".
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 30, max: 6 },
    },
  },
  trustedOrigins: [APP_URL, API_URL, EXPO_URL, ...LAN_ORIGINS, "controlai://"],
  // bearer: permite autenticar via header "Authorization: Bearer <token>",
  // usado pelo app mobile (sem cookie jar confiável) — coexiste com o cookie do web.
  // (o plugin server-side "expo" de @better-auth/expo não foi adicionado: ele traz
  // zod v4 como dependência direta, conflitando com o zod v3 do projeto e quebrando
  // a inferência de tipo de `auth` — TS2742. Só é necessário pra OAuth/deep-link no
  // mobile, fora de escopo desta fase.)
  // twoFactor: só TOTP (app autenticador) + códigos de backup — sem SMS/email OTP
  // (otpOptions não configurado), decisão já tomada no roadmap desta fase.
  plugins: [bearer(), twoFactor()],
});

// O plugin twoFactor() usa zod v4 internamente (better-auth depende de ^4.3.6),
// enquanto o resto do monorepo usa zod v3 — isso faz o tipo inferido de `auth`
// referenciar um módulo zod v4 interno "não portável" (TS2742), e apps/api e
// apps/mobile ainda resolvem versões ligeiramente diferentes do pacote
// better-auth no pnpm, o que torna qualquer anotação de tipo "cheia"
// inconsistente entre os dois (TS2322 comparando tipos "iguais" mas de
// módulos diferentes). Como só usamos `handler` e `api.getSession` em todo
// o app, exportamos apenas essa superfície mínima em vez de lutar contra
// esse problema de resolução de dependências.
type MinimalAuth = {
  handler: (request: Request) => Promise<Response>;
  api: {
    getSession: (opts: { headers: Headers }) => Promise<{
      session: { id: string; token: string; userId: string; expiresAt: Date };
      user: { id: string; email: string; name: string; role: string; twoFactorEnabled: boolean };
    } | null>;
  };
};

export const auth = betterAuthResult as unknown as MinimalAuth;
