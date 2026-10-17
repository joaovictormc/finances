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
│   │       │   ├── ai/            chat (Groq/Claude/Ollama), providers,
│   │       │   │                  credentials, ai-settings, financial-insights,
│   │       │   │                  category-suggester, receipt-parser,
│   │       │   │                  recurring-detector, budget-forecast
│   │       │   ├── import/        csv-parser, ofx-parser
│   │       │   ├── pdf/           annual-report
│   │       │   ├── pluggy/        client.ts
│   │       │   ├── auth.ts, bootstrap-admin.ts, groups.ts, redis.ts,
│   │       │   ├── mercadopago.ts, pix.ts, pix-checkout.ts, payment-methods.ts,
│   │       │   ├── plans.ts, plan-limits.ts, plan-prices.ts, plan-grant.ts,
│   │       │   ├── billing-interval.ts, subscription-period.ts,
│   │       │   ├── referrals.ts, notifications.ts, push.ts,
│   │       │   ├── gamification.ts, gamification-settings.ts, prize-description.ts
│   │       ├── middleware/        auth.ts (requireAuth), admin.ts (requireAdmin)
│   │       └── emails/            Templates React Email
│   ├── web/                       Next.js (App Router)
│   │   └── app/
│   │       ├── (auth)/            login, registro
│   │       └── (dashboard)/       overview, transactions, accounts, budgets,
│   │                              goals, bills, groups, rewards, assistant,
│   │                              settings/billing, admin/ (users, pricing,
│   │                              payment-methods, checkouts, ai, gamification)
│   └── mobile/                    Expo SDK 57 + expo-router — abas (index,
│                                  transactions, budgets, accounts, assistant,
│                                  more) mais telas de notificações, recompensas,
│                                  grupos, metas, contas a pagar e planos
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

Agendamentos em `jobs/scheduler.ts` (`SCHEDULES`), sempre no fuso **America/Sao_Paulo** — independente do relógio do servidor (no Docker é UTC). Cada boot registra com `upsertJobScheduler` (id fixo, não duplica) e remove agendamentos que saíram da lista.

| Horário (Brasília) | Rotina |
|---|---|
| Dia 1, 6h | insight mensal (`fan-out-monthly-insights`) |
| Todo dia, 7h | contas recorrentes (`fan-out-detect-recurring`) |
| Todo dia, 8h | previsão de estouro de orçamento (`fan-out-budget-forecasts`) |
| Segunda, 6h | resumo semanal da gamificação (`fan-out-weekly-recap`) |
| Todo dia, 9h | Pix pendentes, aviso ao admin (`scan-pix-checkouts`) |
| Todo dia, 8h | lembrete de contas a pagar: 3 dias antes e no dia (`send-bill-reminders`) |
| Todo dia, 9h | assinatura Pix vencendo: 5 dias antes e no dia (`send-pix-expiry-reminders`) |

Lembretes (`lib/reminders.ts`) gravam uma chave em `metadata.dedupKey` da notificação: rodar a rotina de novo não repete o aviso. Fora das rotinas: cobrança recusada no cartão avisa no webhook do Mercado Pago (assinatura ativa que vira atrasada) e marcos de meta (50/75/100%) avisam quando o valor da meta sobe.
