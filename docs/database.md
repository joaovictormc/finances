# Banco de Dados

Schema em: `packages/db/prisma/schema.prisma`

## Grupos de Tabelas

### Identidade (gerenciado pelo Better Auth)
- `User` — id, name, email, emailVerified, image, createdAt
- `Session` — token, userId, expiresAt, ipAddress, userAgent
- `Account` — OAuth accounts por provider
- `Verification` — tokens de verificação de email

### Perfil Estendido
- `UserProfile` — `telegramChatId` (BigInt unique), `whatsappPhone` (unique), `timezone` ("America/Sao_Paulo")

### Grupos Familiares
- `Group` — name, ownerId
- `GroupMember` — groupId, userId, role (owner/admin/member/viewer)

### Finanças Core
- `FinancialAccount` — type, name, institution, currency, color, balance, pluggyItemId, isArchived
- `Category` — hierárquica via `parentId`; `isSystem: true` para categorias padrão BR
- `Transaction` — **tabela principal**, hypertable TimescaleDB em `date`
- `Budget` — amount, period, alertThreshold (0.80 default), categoryId (opcional = geral)
- `RecurringBill` — detected by IA or manual, nextDueDate
- `Goal` — name, targetAmount, currentAmount, deadline

### Open Finance Brasil
- `OpenFinanceConsent` — consentId (unique), status, expiresAt, accessTokenEnc (criptografado), syncCursor
- `OpenFinanceAccount` — accountId externo, consentId, FinancialAccount linkado

### Bots
- `BotConversation` — unique (platform, platformChatId); state (idle/awaiting_amount/awaiting_confirmation/nl_query)
- `BotMessage` — direction (inbound/outbound), parsedIntent, parsedData (JSON), aiConfidence, resultedInTransactionId

### Notificações e IA
- `Notification` — channel (email/telegram/whatsapp/push), status, sentAt
- `AiInsight` — type (monthly_summary/spending_anomaly/overdraft_risk/budget_forecast/recurring_detected), content JSON

## Transaction — Tabela Principal

```prisma
model Transaction {
  id              String    @id @default(cuid())
  userId          String
  accountId       String
  categoryId      String?
  type            TransactionType  // income | expense | transfer
  amount          Decimal   @db.Decimal(15, 2)
  description     String
  date            DateTime  // coluna do hypertable TimescaleDB
  notes           String?
  isIgnored       Boolean   @default(false)
  source          TransactionSource  // manual | open_finance | telegram | whatsapp | import
  externalId      String?   // dedup para sincronização bancária
  aiCategoryConfidence Float?
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

Isso particiona a tabela por data, melhorando drasticamente queries com filtro de período (ex: relatório mensal).

## Seed de Categorias BR

Rodar com `pnpm db:seed` — cria categorias sistema (`isSystem: true`):

**Gastos:**
- Alimentação → Supermercado, Restaurante, Lanche, Delivery, Padaria
- Transporte → Combustível, Uber/Táxi, Transporte Público, Manutenção, Estacionamento
- Moradia → Aluguel, Condomínio, Energia, Água, Internet, Telefone, Gás, Reforma
- Saúde → Consulta, Remédios, Plano de Saúde, Academia, Dentista
- Educação → Faculdade, Cursos, Livros, Material Escolar
- Lazer → Streaming, Cinema/Teatro, Viagens, Hobbies, Jogos
- Vestuário → Roupas, Calçados, Acessórios
- Finanças → Impostos, Seguros, Investimentos, Taxas Bancárias
- Pet → Veterinário, Ração, Pet Shop
- Outros Gastos

**Receitas:**
- Salário, Renda Extra, Benefícios, Outras Receitas

**Transferência**

## Relacionamentos Principais

```
User ──┬── UserProfile (1:1)
       ├── FinancialAccount[] (1:N)
       ├── Transaction[] (1:N)
       ├── Category[] (1:N, custom)
       ├── Budget[] (1:N)
       └── BotConversation[] (1:N, por platform)

Transaction ──┬── FinancialAccount (N:1)
              ├── Category (N:1, opcional)
              └── BotMessage.resultedInTransactionId (1:0-1)

Category ──── Category (self-ref via parentId, hierárquico)
```
