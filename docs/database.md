# Banco de Dados

Schema em: `packages/db/prisma/schema.prisma` (26 models).

## Grupos de Tabelas

### Identidade (gerenciado pelo Better Auth)
- `User` — id, name, email, emailVerified, image, **role** (`user`/`support`/`admin`), createdAt
- `Session` — token, userId, expiresAt, ipAddress, userAgent
- `Account` — OAuth accounts por provider
- `Verification` — tokens de verificação de email

### Perfil Estendido
- `UserProfile` — `telegramChatId` (BigInt unique), `whatsappPhone` (unique), `timezone` ("America/Sao_Paulo")

### Grupos Familiares
- `Group` — name, ownerId, inviteCode
- `GroupMember` — groupId, userId, role (owner/admin/member/viewer)

### Finanças Core
- `FinancialAccount` — type, name, institution, currency, color, **hasCreditCard** (Fase 8), pluggyItemId/pluggyAccountId, lastSyncedAt, isArchived
- `Category` — hierárquica via `parentId`; `isSystem: true` para categorias padrão BR
- `Transaction` — **tabela principal**, hypertable TimescaleDB em `date`; ganhou **`paymentMethod`** (`debit`/`credit`, Fase 8)
- `Budget` — amount, period, alertThreshold (0.80 default), categoryId (opcional = geral)
- `RecurringBill` — detectado por IA ou manual, nextDueDate
- `Goal` — name, targetAmount, currentAmount, deadline

### Open Finance Brasil (schema pronto, integração real pendente)
- `OpenFinanceConsent` — consentId (unique), status, expiresAt, accessTokenEnc (criptografado), syncCursor
- `OpenFinanceAccount` — accountId externo, consentId, FinancialAccount linkado

### Bots
- `BotConversation` — unique (platform, platformChatId); state (idle/awaiting_amount/awaiting_confirmation/nl_query)
- `BotMessage` — direction (inbound/outbound), parsedIntent, parsedData (JSON), aiConfidence, resultedInTransactionId

### Notificações e IA
- `Notification` — channel (email/telegram/whatsapp/push), status, sentAt
- `AiInsight` — type (monthly_summary/spending_anomaly/overdraft_risk/budget_forecast/recurring_detected), content JSON
- `AiSettings` — singleton (`id: "singleton"`): `textModel`, `audioModel`, kill-switches por feature (`expenseParsingEnabled`, `monthlyInsightsEnabled`, `nlQueryEnabled`), `monthlyTokenLimit`
- `AiUsageLog` — userId opcional, feature, model, promptTokens/completionTokens, createdAt (indexado por feature/data)

### Monetização
- `Subscription` — userId (unique), plan (free/pro/familia), status (active/past_due/canceled), `mpPreapprovalId` (prefixo `pix:` quando pago via Pix), currentPeriodEnd, canceledAt
- `PaymentEvent` — `mpEventId` (unique, idempotência de webhook), type, rawPayload (JSON) — usado tanto pra eventos do Mercado Pago quanto pra ações manuais do admin (`admin_plan_override`, `pix_checkout_created`, `pix_payment_confirmed` etc.)
- `PaymentMethodConfig` — singleton por método (`id: "mercadopago" | "pix"`), `enabled`, `config` (JSON com chaves/tokens — segredos mascarados na API)
- `ReferralCode` — código único por usuário
- `Referral` — referrerId, referredId (unique), rewardGranted

## Transaction — Tabela Principal

```prisma
model Transaction {
  id              String    @id @default(cuid())
  userId          String
  accountId       String
  categoryId      String?
  groupId         String?
  type            String    // income | expense | transfer
  paymentMethod   String    @default("debit") // debit | credit — Fase 8
  amount          Decimal   @db.Decimal(15, 2)
  description     String
  date            DateTime  @db.Date // coluna do hypertable TimescaleDB
  notes           String?
  isIgnored       Boolean   @default(false)
  source          String    @default("manual") // manual | open_finance | telegram | whatsapp | import
  externalId      String?   // dedup para sincronização/import
  aiCategoryConfidence Decimal? @db.Decimal(4, 3)
  aiMerchantName  String?
  aiTags          String[]
  createdAt       DateTime  @default(now())
}
```

**Atenção:** `amount` é `Decimal` — ao serializar como JSON, vira string. Sempre converter:
```typescript
Number(transaction.amount)  // antes de formatBRL() ou aritmética
```

## TimescaleDB Hypertable

Após o primeiro `prisma migrate deploy`, executar no psql:
```sql
SELECT create_hypertable('transactions', 'date', if_not_exists => TRUE);
```

Isso particiona a tabela por data, melhorando drasticamente queries com filtro de período (ex: relatório mensal, relatório anual em PDF).

## Padrão de migração usado neste projeto

Por rodar contra um banco compartilhado (ZimaOS via Tailscale), alterações de schema neste projeto costumam ser aplicadas via **script `.ts` temporário** com `db.$executeRawUnsafe("ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...")`, seguido de `prisma generate` — em vez de `prisma migrate dev`. O script é deletado depois de aplicado; o `schema.prisma` é a fonte da verdade do shape final.

## Seed de Categorias BR

Rodar com `pnpm db:seed` — cria categorias sistema (`isSystem: true`):

**Gastos:**
- Alimentação → Supermercado, Restaurante, Lanche, Delivery, Padaria
- Transporte → Combustível, Uber/99, Transporte Público, Manutenção, Estacionamento
- Moradia → Aluguel, Condomínio, Energia, Água, Internet, Telefone, Gás, Reforma
- Saúde → Plano de Saúde, Farmácia, Consultas, Exames, Academia
- Educação → Faculdade/Escola, Cursos, Livros e Material
- Lazer → Cinema/Teatro, Viagens, Streaming, Jogos, Esportes, Bares e Baladas
- Vestuário → Roupas, Calçados, Acessórios
- (e demais categorias de gasto/receita/transferência)

**Receitas:** Salário, Renda Extra, Benefícios, Outras Receitas

**Transferência**

## Relacionamentos Principais

```
User ──┬── UserProfile (1:1)
       ├── FinancialAccount[] (1:N)
       ├── Transaction[] (1:N)
       ├── Category[] (1:N, custom)
       ├── Budget[] (1:N)
       ├── Subscription (1:1)
       ├── ReferralCode (1:1)
       ├── Referral[] (1:N, como referrer/referred)
       ├── GroupMember[] (1:N)
       └── BotConversation[] (1:N, por platform)

Transaction ──┬── FinancialAccount (N:1)
              ├── Category (N:1, opcional)
              ├── Group (N:1, opcional — compartilhamento)
              └── BotMessage.resultedInTransactionId (1:0-1)

FinancialAccount ──── Group (N:1, opcional — compartilhamento)
Category ──── Category (self-ref via parentId, hierárquico)
```
