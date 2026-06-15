# Arquitetura

## Stack

| Camada | Tecnologia | Versão | Notas |
|---|---|---|---|
| Monorepo | Turborepo + pnpm 11 workspaces | turbo ^2.3 | Cache incremental de builds |
| Web | Next.js (App Router) | 16.x | React Server Components, Tailwind v4 |
| Mobile | Expo SDK 54 + Expo Router v4 | ~54.0.0 | Compatível com Expo Go SDK 54 |
| API | Hono | ^4.7 | Port 3001, serve web + mobile + bots |
| Banco | PostgreSQL 16 + TimescaleDB | pg16 | Hypertable para transações |
| ORM | Prisma | ^6.x | Em `packages/db` |
| Cache/Queue | Redis 7 + BullMQ | redis:7-alpine | Filas assíncronas |
| Auth | Better Auth | ^1.2 | Framework-agnóstico, sessão em Redis |
| Email | Brevo + React Email | @getbrevo/brevo ^2.2 | 300 emails/dia grátis |
| Bot | grammy (Telegram) | ^1.34 | Zero aprovação, zero custo |
| NLP | Claude API | claude-haiku-4-5 / sonnet-4-6 | Parsing + insights em PT-BR |
| Banco real | Pluggy → Open Finance Brasil | fase 3 | Pluggy sem aprovação; OFB com RAIDIAM |

## Estrutura do Monorepo

```
finances/
├── apps/
│   ├── api/               Hono API (port 3001)
│   │   └── src/
│   │       ├── index.ts   Entry point, monta rotas e workers
│   │       ├── routes/    transactions, accounts, budgets, categories, bots/
│   │       ├── jobs/      queues.ts + workers/ (email, bot, voz, sync, IA)
│   │       ├── lib/       auth.ts, redis.ts, email.ts, ai/expense-parser.ts
│   │       └── emails/    Templates React Email
│   ├── web/               Next.js (App Router)
│   │   └── app/
│   │       ├── (auth)/    login, registro
│   │       └── (dashboard)/ overview, transactions, budgets, accounts, bot...
│   └── mobile/            Expo SDK 54
│       └── app/
│           └── (tabs)/    index (overview), transactions, profile
├── packages/
│   ├── db/                Prisma schema + client + seed
│   ├── validations/       Zod schemas compartilhados
│   └── config/            tsconfig base/nextjs/hono
├── docs/                  Esta documentação
└── docker-compose.yml     PostgreSQL + Redis + Mailpit (local)
```

## Fluxo de Dados

```
Browser/App
    │
    ▼
Next.js (SSR + client)          Telegram Bot
    │                                │
    ▼                                ▼
Hono API (:3001) ──────────── grammy webhook
    │               ┌───────────────┘
    ├─ Better Auth  │
    ├─ Routes       │
    └─ BullMQ ──────┘
         │
         ├── email-worker  → Brevo API
         ├── bot-worker    → Claude Haiku → Telegram
         ├── voice-worker  → Whisper → Claude → Telegram
         ├── sync-worker   → Pluggy / Open Finance Brasil
         └── ai-worker     → Claude Sonnet → AiInsight
              │
              ▼
         PostgreSQL + TimescaleDB
         Redis (sessões, filas, estado bot)
```

## Infraestrutura — ZimaOS

O servidor ZimaOS (home server) hospeda PostgreSQL e Redis, acessível via Tailscale:

- PostgreSQL: `100.104.200.37:5432`
- Redis: `100.104.200.37:6379`

A API de desenvolvimento roda local e conecta ao servidor remoto via Tailscale VPN.

## Autenticação

Better Auth com:
- Email + senha (requer verificação de email)
- Google OAuth
- Sessão cacheada no Redis (TTL 5 minutos, evita consulta ao banco por request)
- Cookies HttpOnly, SameSite=Lax

## Jobs Assíncronos (BullMQ)

| Queue | Worker | Trigger |
|---|---|---|
| `email` | `email.worker.ts` | `sendEmail()` de qualquer rota/worker |
| `bot-messages` | `bot-messages.worker.ts` | Webhook Telegram/WhatsApp |
| `voice-transcription` | futuro | Mensagem de voz no bot |
| `open-finance-sync` | futuro | Agendado 6h BRT ou manual |
| `ai-analysis` | futuro | Agendado 1° de cada mês |
| `bill-detector` | futuro | Semanal |
