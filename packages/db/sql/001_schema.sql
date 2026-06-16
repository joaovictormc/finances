-- =============================================================================
-- Finances SaaS — Schema Inicial
-- PostgreSQL 16 + TimescaleDB
--
-- Como executar:
--   psql -h 100.104.200.37 -U postgres -d finances -f 001_schema.sql
--
-- Após executar: rodar 002_seed_categories.sql
-- =============================================================================

-- Extensão TimescaleDB (instalar antes: CREATE EXTENSION IF NOT EXISTS timescaledb;)
-- Se TimescaleDB não estiver disponível, remova o bloco SELECT create_hypertable abaixo.
-- A tabela transactions funciona normalmente como PostgreSQL puro sem isso.

CREATE SCHEMA IF NOT EXISTS "public";

-- -----------------------------------------------------------------------------
-- IDENTITY (Better Auth)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "users" (
    "id"            TEXT        NOT NULL,
    "name"          TEXT        NOT NULL,
    "email"         TEXT        NOT NULL,
    "emailVerified" BOOLEAN     NOT NULL,
    "image"         TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sessions" (
    "id"        TEXT        NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token"     TEXT        NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId"    TEXT        NOT NULL,
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "accounts" (
    "id"                    TEXT        NOT NULL,
    "accountId"             TEXT        NOT NULL,
    "providerId"            TEXT        NOT NULL,
    "userId"                TEXT        NOT NULL,
    "accessToken"           TEXT,
    "refreshToken"          TEXT,
    "idToken"               TEXT,
    "accessTokenExpiresAt"  TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope"                 TEXT,
    "password"              TEXT,
    "createdAt"             TIMESTAMP(3) NOT NULL,
    "updatedAt"             TIMESTAMP(3) NOT NULL,
    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "verifications" (
    "id"         TEXT        NOT NULL,
    "identifier" TEXT        NOT NULL,
    "value"      TEXT        NOT NULL,
    "expiresAt"  TIMESTAMP(3) NOT NULL,
    "createdAt"  TIMESTAMP(3),
    "updatedAt"  TIMESTAMP(3),
    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_profiles" (
    "id"                    TEXT        NOT NULL,
    "userId"                TEXT        NOT NULL,
    "cpf"                   TEXT,
    "phoneE164"             TEXT,
    "telegramChatId"        BIGINT,
    "whatsappPhone"         TEXT,
    "defaultCurrency"       TEXT        NOT NULL DEFAULT 'BRL',
    "timezone"              TEXT        NOT NULL DEFAULT 'America/Sao_Paulo',
    "aiInsightsEnabled"     BOOLEAN     NOT NULL DEFAULT true,
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- -----------------------------------------------------------------------------
-- GROUPS (compartilhamento familiar)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "groups" (
    "id"         TEXT        NOT NULL,
    "name"       TEXT        NOT NULL,
    "ownerId"    TEXT        NOT NULL,
    "inviteCode" TEXT        NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "group_members" (
    "groupId"  TEXT        NOT NULL,
    "userId"   TEXT        NOT NULL,
    "role"     TEXT        NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "group_members_pkey" PRIMARY KEY ("groupId", "userId")
);

-- -----------------------------------------------------------------------------
-- CORE FINANCE
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "financial_accounts" (
    "id"                   TEXT        NOT NULL,
    "userId"               TEXT        NOT NULL,
    "groupId"              TEXT,
    "type"                 TEXT        NOT NULL,
    "name"                 TEXT        NOT NULL,
    "institution"          TEXT,
    "currency"             TEXT        NOT NULL DEFAULT 'BRL',
    "color"                TEXT,
    "icon"                 TEXT,
    "isArchived"           BOOLEAN     NOT NULL DEFAULT false,
    "openFinanceAccountId" TEXT,
    "pluggyItemId"         TEXT,
    "lastSyncedAt"         TIMESTAMP(3),
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "categories" (
    "id"       TEXT    NOT NULL,
    "userId"   TEXT,
    "parentId" TEXT,
    "name"     TEXT    NOT NULL,
    "icon"     TEXT,
    "color"    TEXT,
    "type"     TEXT    NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- Nota: PK simples em "id" (igual ao schema Prisma). Tabela PostgreSQL normal.
--       Hypertable do TimescaleDB foi removida porque (a) exigiria "date" na PK e
--       (b) o TimescaleDB não permite foreign keys apontando para um hypertable —
--       e "bot_messages" referencia transactions("id"). Ver bloco no final do arquivo.
CREATE TABLE IF NOT EXISTS "transactions" (
    "id"                    TEXT           NOT NULL,
    "userId"                TEXT           NOT NULL,
    "accountId"             TEXT           NOT NULL,
    "categoryId"            TEXT,
    "groupId"               TEXT,
    "type"                  TEXT           NOT NULL,
    "amount"                DECIMAL(15,2)  NOT NULL,
    "currency"              TEXT           NOT NULL DEFAULT 'BRL',
    "description"           TEXT           NOT NULL,
    "notes"                 TEXT,
    "date"                  DATE           NOT NULL,
    "source"                TEXT           NOT NULL DEFAULT 'manual',
    "externalId"            TEXT,
    "rawDescription"        TEXT,
    "aiCategoryConfidence"  DECIMAL(4,3),
    "aiMerchantName"        TEXT,
    "aiTags"                TEXT[]         NOT NULL DEFAULT '{}',
    "transferPairId"        TEXT,
    "recurringBillId"       TEXT,
    "isIgnored"             BOOLEAN        NOT NULL DEFAULT false,
    "createdAt"             TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "budgets" (
    "id"             TEXT          NOT NULL,
    "userId"         TEXT          NOT NULL,
    "groupId"        TEXT,
    "categoryId"     TEXT,
    "name"           TEXT          NOT NULL,
    "amount"         DECIMAL(15,2) NOT NULL,
    "period"         TEXT          NOT NULL DEFAULT 'monthly',
    "startDate"      DATE          NOT NULL,
    "endDate"        DATE,
    "alertThreshold" DECIMAL(4,3)  NOT NULL DEFAULT 0.80,
    "createdAt"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "recurring_bills" (
    "id"              TEXT          NOT NULL,
    "userId"          TEXT          NOT NULL,
    "categoryId"      TEXT,
    "accountId"       TEXT,
    "name"            TEXT          NOT NULL,
    "expectedAmount"  DECIMAL(15,2),
    "amountVariance"  DECIMAL(15,2),
    "frequency"       TEXT          NOT NULL,
    "dayOfMonth"      INTEGER,
    "nextDueDate"     DATE,
    "lastPaidDate"    DATE,
    "merchantPattern" TEXT,
    "isActive"        BOOLEAN       NOT NULL DEFAULT true,
    "createdAt"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recurring_bills_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "goals" (
    "id"              TEXT          NOT NULL,
    "userId"          TEXT          NOT NULL,
    "groupId"         TEXT,
    "linkedAccountId" TEXT,
    "name"            TEXT          NOT NULL,
    "description"     TEXT,
    "targetAmount"    DECIMAL(15,2) NOT NULL,
    "currentAmount"   DECIMAL(15,2) NOT NULL DEFAULT 0,
    "targetDate"      DATE,
    "icon"            TEXT,
    "color"           TEXT,
    "isCompleted"     BOOLEAN       NOT NULL DEFAULT false,
    "createdAt"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- -----------------------------------------------------------------------------
-- OPEN FINANCE BRASIL
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "open_finance_consents" (
    "id"              TEXT        NOT NULL,
    "userId"          TEXT        NOT NULL,
    "bankIspb"        TEXT        NOT NULL,
    "bankName"        TEXT        NOT NULL,
    "consentId"       TEXT        NOT NULL,
    "status"          TEXT        NOT NULL,
    "permissions"     TEXT[]      NOT NULL DEFAULT '{}',
    "accessTokenEnc"  TEXT,
    "refreshTokenEnc" TEXT,
    "tokenExpiresAt"  TIMESTAMP(3),
    "lastSyncAt"      TIMESTAMP(3),
    "syncError"       TEXT,
    "syncCursor"      TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt"       TIMESTAMP(3),
    CONSTRAINT "open_finance_consents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "open_finance_accounts" (
    "id"                TEXT          NOT NULL,
    "consentId"         TEXT          NOT NULL,
    "financialAccountId" TEXT,
    "ofAccountId"       TEXT          NOT NULL,
    "ofAccountType"     TEXT          NOT NULL,
    "brandName"         TEXT,
    "branchCode"        TEXT,
    "numberLast4"       TEXT,
    "checkDigit"        TEXT,
    "balance"           DECIMAL(15,2),
    "balanceUpdatedAt"  TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "open_finance_accounts_pkey" PRIMARY KEY ("id")
);

-- -----------------------------------------------------------------------------
-- BOTS E NOTIFICAÇÕES
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "bot_conversations" (
    "id"             TEXT        NOT NULL,
    "userId"         TEXT        NOT NULL,
    "platform"       TEXT        NOT NULL,
    "platformChatId" TEXT        NOT NULL,
    "state"          TEXT        NOT NULL DEFAULT 'idle',
    "context"        JSONB,
    "lastMessageAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bot_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "bot_messages" (
    "id"                       TEXT         NOT NULL,
    "conversationId"           TEXT         NOT NULL,
    "direction"                TEXT         NOT NULL,
    "messageType"              TEXT         NOT NULL,
    "content"                  TEXT,
    "rawPayload"               JSONB,
    "parsedIntent"             TEXT,
    "parsedData"               JSONB,
    "aiConfidence"             DECIMAL(4,3),
    "resultedInTransactionId"  TEXT,
    "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bot_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "notifications" (
    "id"        TEXT        NOT NULL,
    "userId"    TEXT        NOT NULL,
    "type"      TEXT        NOT NULL,
    "channel"   TEXT        NOT NULL,
    "title"     TEXT        NOT NULL,
    "body"      TEXT        NOT NULL,
    "metadata"  JSONB,
    "status"    TEXT        NOT NULL DEFAULT 'pending',
    "sentAt"    TIMESTAMP(3),
    "readAt"    TIMESTAMP(3),
    "error"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ai_insights" (
    "id"           TEXT        NOT NULL,
    "userId"       TEXT        NOT NULL,
    "type"         TEXT        NOT NULL,
    "title"        TEXT        NOT NULL,
    "body"         TEXT        NOT NULL,
    "data"         JSONB,
    "severity"     TEXT        NOT NULL DEFAULT 'info',
    "periodStart"  DATE,
    "periodEnd"    DATE,
    "isRead"       BOOLEAN     NOT NULL DEFAULT false,
    "isDismissed"  BOOLEAN     NOT NULL DEFAULT false,
    "generatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_insights_pkey" PRIMARY KEY ("id")
);

-- -----------------------------------------------------------------------------
-- ÍNDICES
-- -----------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key"               ON "users"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_key"            ON "sessions"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "user_profiles_userId_key"      ON "user_profiles"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "user_profiles_telegramChatId_key" ON "user_profiles"("telegramChatId");
CREATE UNIQUE INDEX IF NOT EXISTS "user_profiles_whatsappPhone_key"  ON "user_profiles"("whatsappPhone");
CREATE UNIQUE INDEX IF NOT EXISTS "groups_inviteCode_key"         ON "groups"("inviteCode");
CREATE UNIQUE INDEX IF NOT EXISTS "open_finance_consents_consentId_key" ON "open_finance_consents"("consentId");
CREATE UNIQUE INDEX IF NOT EXISTS "bot_conversations_platform_platformChatId_key"
    ON "bot_conversations"("platform", "platformChatId");

-- transactions: índice composto para queries de dashboard por usuário + período
CREATE INDEX IF NOT EXISTS "transactions_userId_date_idx"   ON "transactions"("userId", "date");
CREATE INDEX IF NOT EXISTS "transactions_accountId_date_idx" ON "transactions"("accountId", "date");
-- Dedup de transações vindas de Open Finance / Pluggy
CREATE UNIQUE INDEX IF NOT EXISTS "transactions_externalId_accountId_key"
    ON "transactions"("externalId", "accountId")
    WHERE "externalId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "notifications_userId_status_idx" ON "notifications"("userId", "status");
CREATE INDEX IF NOT EXISTS "ai_insights_userId_isRead_idx"   ON "ai_insights"("userId", "isRead");

-- -----------------------------------------------------------------------------
-- FOREIGN KEYS
-- -----------------------------------------------------------------------------

ALTER TABLE "sessions"
    ADD CONSTRAINT "sessions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "accounts"
    ADD CONSTRAINT "accounts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "user_profiles"
    ADD CONSTRAINT "user_profiles_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "groups"
    ADD CONSTRAINT "groups_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "users"("id");

ALTER TABLE "group_members"
    ADD CONSTRAINT "group_members_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE;

ALTER TABLE "group_members"
    ADD CONSTRAINT "group_members_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "financial_accounts"
    ADD CONSTRAINT "financial_accounts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "financial_accounts"
    ADD CONSTRAINT "financial_accounts_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL;

ALTER TABLE "categories"
    ADD CONSTRAINT "categories_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "categories"
    ADD CONSTRAINT "categories_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL;

ALTER TABLE "transactions"
    ADD CONSTRAINT "transactions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "transactions"
    ADD CONSTRAINT "transactions_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "financial_accounts"("id");

ALTER TABLE "transactions"
    ADD CONSTRAINT "transactions_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL;

ALTER TABLE "transactions"
    ADD CONSTRAINT "transactions_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL;

ALTER TABLE "transactions"
    ADD CONSTRAINT "transactions_recurringBillId_fkey"
    FOREIGN KEY ("recurringBillId") REFERENCES "recurring_bills"("id") ON DELETE SET NULL;

ALTER TABLE "budgets"
    ADD CONSTRAINT "budgets_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "budgets"
    ADD CONSTRAINT "budgets_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL;

ALTER TABLE "budgets"
    ADD CONSTRAINT "budgets_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL;

ALTER TABLE "recurring_bills"
    ADD CONSTRAINT "recurring_bills_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "recurring_bills"
    ADD CONSTRAINT "recurring_bills_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL;

ALTER TABLE "recurring_bills"
    ADD CONSTRAINT "recurring_bills_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "financial_accounts"("id") ON DELETE SET NULL;

ALTER TABLE "goals"
    ADD CONSTRAINT "goals_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "goals"
    ADD CONSTRAINT "goals_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL;

ALTER TABLE "goals"
    ADD CONSTRAINT "goals_linkedAccountId_fkey"
    FOREIGN KEY ("linkedAccountId") REFERENCES "financial_accounts"("id") ON DELETE SET NULL;

ALTER TABLE "open_finance_consents"
    ADD CONSTRAINT "open_finance_consents_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "open_finance_accounts"
    ADD CONSTRAINT "open_finance_accounts_consentId_fkey"
    FOREIGN KEY ("consentId") REFERENCES "open_finance_consents"("id") ON DELETE CASCADE;

ALTER TABLE "open_finance_accounts"
    ADD CONSTRAINT "open_finance_accounts_financialAccountId_fkey"
    FOREIGN KEY ("financialAccountId") REFERENCES "financial_accounts"("id") ON DELETE SET NULL;

ALTER TABLE "bot_conversations"
    ADD CONSTRAINT "bot_conversations_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "bot_messages"
    ADD CONSTRAINT "bot_messages_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "bot_conversations"("id") ON DELETE CASCADE;

ALTER TABLE "bot_messages"
    ADD CONSTRAINT "bot_messages_resultedInTransactionId_fkey"
    FOREIGN KEY ("resultedInTransactionId") REFERENCES "transactions"("id") ON DELETE SET NULL;

ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "ai_insights"
    ADD CONSTRAINT "ai_insights_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;

-- -----------------------------------------------------------------------------
-- TIMESCALEDB — Hypertable para transactions (DESABILITADO no MVP)
-- -----------------------------------------------------------------------------
-- O hypertable foi removido intencionalmente por dois motivos incompatíveis com
-- o schema atual:
--   1. Um hypertable exige que a coluna de particionamento ("date") faça parte
--      da PRIMARY KEY — mas a PK é apenas ("id"), igual ao schema Prisma.
--   2. O TimescaleDB NÃO permite FOREIGN KEYS apontando para um hypertable, e a
--      tabela "bot_messages" tem FK para transactions("id").
--
-- Para habilitar no futuro (otimização de performance em escala), seria preciso:
--   - Tornar a PK composta ("id", "date");
--   - Remover a FK "bot_messages_resultedInTransactionId_fkey" (vira referência
--     lógica, sem constraint);
--   - Então: SELECT create_hypertable('transactions', 'date',
--              chunk_time_interval => INTERVAL '1 month', if_not_exists => TRUE);
