# Arquitetura

## Stack

| Camada | Tecnologia | Versão | Notas |
|---|---|---|---|
| Monorepo | Turborepo + pnpm 11 workspaces | turbo ^2.3 | Cache incremental de builds |
| Web | Next.js (App Router) | 16.x | React 19, Turbopack, Tailwind v4 |
| Mobile | Expo SDK 54 + Expo Router v4 | ~54.0.0 | Só scaffold inicial, sem telas reais |
| API | Hono | ^4.7 | Port 3001, serve web + mobile + bots |
| Banco | PostgreSQL 16 + TimescaleDB | pg16 | Hypertable para transações |
| ORM | Prisma | ^6.x | Em `packages/db` |
| Cache/Queue | Redis 7 + BullMQ | redis:7-alpine | Filas assíncronas |
| Auth | Better Auth | ^1.2 | Framework-agnóstico, sessão em Redis, roles (user/support/admin) |
| Email | Brevo + React Email | @getbrevo/brevo ^2.2 | 300 emails/dia grátis |
| Bot | grammy (Telegram) | ^1.34 | Zero aprovação, zero custo |
| NLP / IA | **Groq** | groq-sdk ^1.2 | Llama 3.3 70B (texto/insights) + Whisper large v3 turbo (voz) — modelos configuráveis via `AiSettings` |
| Banco real | Pluggy | pluggy-connect-sdk ^2.12 | Implementado, atrás de `NEXT_PUBLIC_ENABLE_PLUGGY` (custo mensal); Open Finance Brasil/RAIDIAM ainda só com schema |
| Pagamentos | **Mercado Pago** + Pix direto | mercadopago ^3.1 | Assinaturas recorrentes (preapproval) + Pix com QR code estático e confirmação manual |
| PDF | `@react-pdf/renderer` | ^4.5 | Relatório anual |

## Estrutura do Monorepo

```
finances/
├── apps/
│   ├── api/                       Hono API (port 3001)
│   │   └── src/
│   │       ├── index.ts           Entry point, monta rotas e workers
│   │       ├── routes/
│   │       │   ├── transactions.ts, financial-accounts.ts, categories.ts
│   │       │   ├── budgets.ts, goals.ts, bills.ts, reports.ts
│   │       │   ├── groups.ts, referrals.ts
│   │       │   ├── billing.ts, admin.ts
│   │       │   ├── ai.ts, pluggy.ts
│   │       │   ├── bots/          telegram.ts (webhook), telegram-link.ts
│   │       │   └── webhooks/      mercadopago.ts, pluggy.ts
│   │       ├── jobs/              queues.ts + scheduler.ts + workers/
│   │       ├── lib/
│   │       │   ├── ai/            groq-client, ai-settings, expense-parser,
│   │       │   │                  financial-insights, recurring-detector,
│   │       │   │                  budget-forecast, voice-transcriber
│   │       │   ├── import/        csv-parser, ofx-parser
│   │       │   ├── pdf/           annual-report
│   │       │   ├── pluggy/        client.ts
│   │       │   ├── auth.ts, bootstrap-admin.ts, groups.ts, redis.ts,
│   │       │   ├── mercadopago.ts, pix.ts, payment-methods.ts,
│   │       │   ├── plans.ts, plan-limits.ts, referrals.ts, notifications.ts
│   │       ├── middleware/        auth.ts (requireAuth), admin.ts (requireAdmin)
│   │       └── emails/            Templates React Email
│   ├── web/                       Next.js (App Router)
│   │   └── app/
│   │       ├── (auth)/            login, registro
│   │       └── (dashboard)/       overview, transactions, accounts, budgets,
│   │                              goals, bills, groups, bot, settings, admin/
│   └── mobile/                    Expo SDK 54 — só `(tabs)/index.tsx`
├── packages/
│   ├── db/                        Prisma schema + client + seed
│   ├── validations/                Zod schemas compartilhados
│   └── config/                    tsconfig base/nextjs/hono
├── docs/                          Esta documentação
└── docker-compose.yml             PostgreSQL + Redis + Mailpit (local)
```

## Fluxo de Dados

```
Browser                          Telegram Bot
    │                                │
    ▼                                ▼
Next.js (SSR + client)          grammy webhook
    │                                │
    ▼                                ▼
Hono API (:3001) ──────────────────────┘
    │
    ├─ Better Auth
    ├─ Routes (transactions, accounts, billing, admin, ai, groups...)
    └─ BullMQ
         │
         ├── email-worker             → Brevo API
         ├── bot-messages-worker      → Groq (parsing) → Telegram
         ├── voice-transcription-worker → Groq Whisper → Groq (parsing) → Telegram
         ├── open-finance-sync-worker → Pluggy
         ├── ai-analysis-worker       → Groq → AiInsight (mensal, recorrências, forecast)
         └── bill-detector-worker     → detecta contas recorrentes
              │
              ▼
         PostgreSQL + TimescaleDB
         Redis (sessões, filas, estado do bot)
```

Webhooks externos (Mercado Pago, Pluggy) chegam em `/api/webhooks/*` e gravam em `PaymentEvent` (idempotência) antes de processar.

## Infraestrutura — ZimaOS

O servidor ZimaOS (home server) hospeda PostgreSQL e Redis, acessível via Tailscale:

- PostgreSQL: `100.104.200.37:5432`
- Redis: `100.104.200.37:6379`

A API de desenvolvimento roda local e conecta ao servidor remoto via Tailscale VPN. Variáveis de ambiente carregadas via `process.loadEnvFile` a partir do `.env` na raiz do monorepo (ver `apps/api/src/env.ts`).

## Autenticação e Autorização

Better Auth com:
- Email + senha (verificação de email opcional via `AUTH_REQUIRE_EMAIL_VERIFICATION`)
- Google OAuth
- Sessão cacheada no Redis (TTL 5 minutos, evita consulta ao banco por request)
- Cookies HttpOnly, SameSite=Lax
- `role` (`user` | `support` | `admin`) como additional field — contas admin usam `getEffectivePlan()` para ter acesso total a qualquer feature, independente da assinatura
- `requireAdmin` middleware (`apps/api/src/middleware/admin.ts`) protege todas as rotas `/api/admin/*`

## Jobs Assíncronos (BullMQ)

| Queue | Worker | Trigger |
|---|---|---|
| `email` | `email.worker.ts` | `sendEmail()` de qualquer rota/worker |
| `open-finance-sync` | `open-finance-sync.worker.ts` | Pluggy: nova conta conectada ou webhook |
| `ai-analysis` | `ai-analysis.worker.ts` | Agendado (scheduler) — insight mensal, recorrências, forecast |
| `bill-detector` | `bill-detector.worker.ts` | Agendado — detecta contas recorrentes a partir do histórico |
| `gamification` | `gamification.worker.ts` | Agendado — recap semanal |
| `billing` | `billing.worker.ts` | Agendado (9h) — avisa o admin sobre checkout Pix perto de vencer ou já vencido |
