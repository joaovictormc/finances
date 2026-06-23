# API Reference

Base URL: `http://localhost:3001` (dev) | Autenticação via cookie de sessão Better Auth, exceto onde indicado.

## Auth — Better Auth (`/api/auth/*`)

Gerenciado pelo Better Auth. Principais endpoints:

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/sign-up/email` | Registrar com email+senha |
| POST | `/api/auth/sign-in/email` | Login com email+senha |
| POST | `/api/auth/sign-out` | Logout |
| GET | `/api/auth/get-session` | Sessão atual (inclui `role`) |
| POST | `/api/auth/sign-in/social` | OAuth (Google) |

## Health

```
GET /health
→ { status: "ok", ts: "..." }
```

## Transações

### Listar
```
GET /api/transactions
Query params:
  page        number  (default: 1)
  limit       number  (default: 20, max: 100)
  type        "income" | "expense" | "transfer"
  categoryId  string
  accountId   string
  startDate   string  (YYYY-MM-DD)
  endDate     string  (YYYY-MM-DD)
  search      string  (busca em description)
  isIgnored   boolean
  groupId     string | "personal"

→ { data: Transaction[], meta: { page, limit, total, totalPages } }
```

### Criar / Atualizar / Deletar
```
POST   /api/transactions   { type, paymentMethod?, amount, description, date, accountId, categoryId?, notes?, groupId? }
PATCH  /api/transactions/:id   Partial<CreateTransaction>
DELETE /api/transactions/:id   → { success: true }
```
`paymentMethod` (`"debit" | "credit"`, default `"debit"`) — Fase 8, só relevante quando a conta tem `hasCreditCard: true`.

### Import de extrato (CSV/OFX)
```
POST /api/transactions/import   multipart/form-data
  file           File (.csv ou .ofx)
  accountId      string
  paymentMethod  "debit" | "credit"  (opcional, default "debit" — Fase 8)

→ { imported: number, totalInFile: number }
```
Deduplica por `externalId` (hash do CSV, ou `FITID` do OFX) + `accountId`. Atualiza `FinancialAccount.lastSyncedAt` ao final.

### Relatório Mensal
```
GET /api/transactions/reports/monthly?year=2026&month=6
→ { year, month, income, expense, balance, byCategory: [{ category, total }] }
```

## Contas Financeiras

```
GET    /api/accounts?archived=true     lista contas arquivadas (default: ativas)
POST   /api/accounts   { name, type, institution?, color?, currency?, groupId?, hasCreditCard? }
PATCH  /api/accounts/:id
DELETE /api/accounts/:id              (soft delete via isArchived)
DELETE /api/accounts/:id/permanent    (exige isArchived: true — apaga conta + transações em cascata)
```

Tipos: `checking` | `savings` | `credit_card` | `investment` | `wallet`

## Categorias

```
GET /api/categories?type=expense   → categorias hierárquicas com children[]
GET /api/categories?type=income    → categorias de receita
POST   /api/categories   { name, type, icon?, color?, parentId? }
PATCH  /api/categories/:id
DELETE /api/categories/:id         (somente categorias do usuário, não sistema)
```

## Orçamentos

```
GET /api/budgets?year=2025&month=6
→ Budget[] com campos extras: spentAmount, percentage, isOverBudget, isNearLimit

POST /api/budgets { name, amount, period: "weekly"|"monthly"|"yearly", categoryId?, startDate, endDate?, alertThreshold? }
PATCH  /api/budgets/:id
DELETE /api/budgets/:id
```

## Metas

```
GET /api/goals
POST /api/goals { name, description?, targetAmount, currentAmount?, targetDate?, icon?, color? }
PATCH  /api/goals/:id
DELETE /api/goals/:id
```

## Contas Recorrentes (Bills)

```
GET /api/bills
POST /api/bills { name, expectedAmount?, frequency: "monthly"|"weekly"|"annual"|"custom", dayOfMonth?, nextDueDate?, categoryId?, accountId? }
PATCH  /api/bills/:id   (inclui isActive: boolean)
DELETE /api/bills/:id
```

## Grupos (Fase 5)

```
GET    /api/groups                          grupos do usuário + role + memberCount
POST   /api/groups   { name }                requer plano Família
GET    /api/groups/:id                       detalhe + membros (requer ser membro)
PATCH  /api/groups/:id                       requer owner/admin
DELETE /api/groups/:id                       requer owner — desvincula contas/transações/budgets/goals antes de apagar
GET    /api/groups/:id/invite-link
POST   /api/groups/join/:inviteCode
DELETE /api/groups/:id/members/:userId
PATCH  /api/groups/:id/members/:userId       { role }
GET    /api/groups/:id/dashboard?year=&month=
```

## Referrals (Fase 6)

```
GET  /api/referrals/code      → { code, link }
POST /api/referrals/redeem    { code }
GET  /api/referrals           → { total, rewardsGranted, referrals[] }
```

## Billing — Assinaturas/Pix (Fase 6)

```
GET  /api/billing/plans              → PlanDefinition[] (free/pro/familia)
GET  /api/billing/payment-methods    → { mercadopago: boolean, pix: boolean } (habilitados)
GET  /api/billing/subscription       → { plan, status, currentPeriodEnd, canceledAt, hasIntegrationsModule, hasFamilyModule }
POST /api/billing/checkout           { plan: "pro"|"familia" } → { checkoutUrl } (Mercado Pago)
POST /api/billing/checkout-pix       { plan: "pro"|"familia" } → { payload, txid, amount } (BR Code Pix)
POST /api/billing/cancel             → { success: true }
```

## IA (`/api/ai`, Fase 4)

```
GET   /api/ai/insights                  insights não dispensados do usuário
PATCH /api/ai/insights/:id/dismiss
POST  /api/ai/query   { question }      NL query com tool calling (Groq) sobre as finanças do usuário
```

## Pluggy (`/api/pluggy`, Fase 3 — atrás de `NEXT_PUBLIC_ENABLE_PLUGGY`)

```
POST /api/pluggy/connect-token   → { connectToken }  (403 se o plano não permite conexão bancária)
POST /api/pluggy/items   { itemId }   → cria/atualiza FinancialAccount por conta Pluggy, enfileira sync
```

## Webhooks (sem autenticação de sessão — validados por assinatura/IP)

```
POST /api/webhooks/mercadopago    valida x-signature/x-request-id, grava PaymentEvent, atualiza Subscription
POST /api/webhooks/pluggy         valida IP de origem, enfileira open-finance-sync
```

## Relatórios

```
GET /api/reports/annual?year=2026   → PDF (Content-Type: application/pdf), relatório anual consolidado
```

## Admin (`/api/admin/*`, requer `role: "admin"`)

```
GET   /api/admin/users?q=&page=
PATCH /api/admin/users/:id/role     { role: "user"|"support"|"admin" }
PATCH /api/admin/users/:id/plan     { plan, status? }   override manual, sem cobrar no Mercado Pago
POST  /api/admin/users/:id/subscription/cancel

GET   /api/admin/payment-events?page=&type=
GET   /api/admin/payment-events/types
POST  /api/admin/payment-events/:id/confirm-pix    confirma Pix pendente e ativa o plano

GET   /api/admin/payment-methods                    lista Mercado Pago/Pix com segredos mascarados
PATCH /api/admin/payment-methods/:id   { enabled?, config? }

GET   /api/admin/ai/settings
PATCH /api/admin/ai/settings   { textModel?, audioModel?, expenseParsingEnabled?, monthlyInsightsEnabled?, nlQueryEnabled?, monthlyTokenLimit? }
GET   /api/admin/ai/usage      uso agregado por feature + contagens 1d/7d/30d + uso de tokens do mês
```

## Bots

```
POST   /api/bots/telegram          Webhook do Telegram (grammy)

GET    /api/bots/telegram/status   → { linked: boolean, telegramChatId: string | null }
POST   /api/bots/telegram/link     body { code } → resgata o código gerado pelo /start
                                     no bot (Redis) e grava telegramChatId no perfil.
                                     400 código inválido/expirado · 409 já vinculado a outra conta
DELETE /api/bots/telegram/link     → desvincula o Telegram da conta
```

Fluxo: usuário envia `/start` ao bot → bot gera código de 6 dígitos (Redis, TTL 10min) →
usuário cola o código na página `/bot` do app → `POST /link` valida e vincula.

## Tipos principais

```typescript
type Transaction = {
  id: string
  type: "income" | "expense" | "transfer"
  paymentMethod: "debit" | "credit"   // Fase 8
  amount: string          // Decimal serializado como string
  description: string
  date: string            // ISO 8601
  notes: string | null
  isIgnored: boolean
  source: "manual" | "open_finance" | "telegram" | "whatsapp" | "import"
  category: { id: string; name: string; icon: string | null; color: string | null } | null
  account: { id: string; name: string; institution: string | null; color: string | null }
  groupId?: string | null
  createdAt: string
}

type FinancialAccount = {
  id: string
  type: string
  name: string
  institution: string | null
  color: string | null
  hasCreditCard?: boolean     // Fase 8
  lastSyncedAt?: string | null
  isArchived?: boolean
}

type Budget = {
  id: string
  name: string
  amount: string
  period: string
  alertThreshold: string
  category: { id: string; name: string; icon: string | null } | null
  // Campos calculados:
  spentAmount: number
  percentage: number
  isOverBudget: boolean
  isNearLimit: boolean
}
```
