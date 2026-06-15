# Setup de Desenvolvimento

## Pré-requisitos

- Node.js ≥ 20
- pnpm 11: `npm install -g pnpm@11`
- Docker Desktop (para Mailpit local)
- Tailscale conectado (para acessar PostgreSQL e Redis no ZimaOS)
- Conta no [Brevo](https://app.brevo.com/) para emails
- Conta na [Anthropic](https://console.anthropic.com/) para NLP
- Bot no Telegram criado via @BotFather

## 1. Clonar e instalar

```bash
git clone <repo>
cd finances
cp .env.example .env
# Editar .env com as credenciais reais
pnpm install
```

## 2. Banco de dados (PostgreSQL no ZimaOS)

O PostgreSQL já está rodando no ZimaOS. A `DATABASE_URL` já aponta para `100.104.200.37:5432`.

### Opção A — Script SQL direto (recomendado para primeiro setup)

Os scripts ficam em `packages/db/sql/`. Executar na ordem:

```bash
# 1. Schema completo (todas as tabelas, índices e foreign keys + hypertable TimescaleDB)
psql -h 100.104.200.37 -U postgres -d finances -f packages/db/sql/001_schema.sql

# 2. Seed de categorias BR (idempotente, pode rodar mais de uma vez)
psql -h 100.104.200.37 -U postgres -d finances -f packages/db/sql/002_seed_categories.sql
```

> **TimescaleDB**: o `001_schema.sql` já inclui `SELECT create_hypertable(...)` no final.
> Se TimescaleDB não estiver instalado, remova esse bloco — a tabela `transactions`
> funciona normalmente como PostgreSQL puro.

### Opção B — Via Prisma (workflow de desenvolvimento)

```bash
# Gerar cliente Prisma (obrigatório antes de rodar a API)
pnpm db:generate

# Criar e aplicar migration (precisa de conexão com o banco)
pnpm db:migrate

# Seed de categorias via TypeScript
pnpm db:seed
```

## 3. Redis no ZimaOS

Redis precisa ser instalado no mesmo servidor do PostgreSQL via SSH:

```bash
# SSH no ZimaOS
ssh usuario@100.104.200.37

# Instalar e rodar Redis
docker pull redis:7-alpine
docker volume create finances_redis_data
docker run -d \
  --name finances_redis \
  --restart always \
  -p 6379:6379 \
  -v finances_redis_data:/data \
  redis:7-alpine \
  redis-server --appendonly yes --bind 0.0.0.0

# Verificar
docker exec finances_redis redis-cli ping   # → PONG
```

```bash
# Testar do computador de dev (requer Tailscale conectado)
redis-cli -h 100.104.200.37 ping            # → PONG
```

A `REDIS_URL` no `.env` já aponta para `redis://100.104.200.37:6379`.

## 4. Email local com Mailpit

Para testes locais de email sem consumir cota do Brevo:

```bash
docker compose up -d mailpit
# Acesse http://localhost:8025 para ver emails enviados
```

Para usar Mailpit no dev, mude temporariamente `BREVO_API_KEY=""` e use SMTP via `smtp://localhost:1025` (requer configurar `email.ts` para SMTP local em dev).

## 5. Rodar todos os apps

```bash
pnpm dev
# Web:    http://localhost:3000
# API:    http://localhost:3001
# Mobile: Expo Dev Server (QR code no terminal)
```

## 6. Expo Go (Mobile)

1. Instale o **Expo Go** no celular (versão SDK 54)
2. Com o dev server rodando (`pnpm --filter @finances/mobile dev`)
3. Escaneie o QR code com o Expo Go

## Variáveis de Ambiente

| Variável | Obrigatória | Onde obter |
|---|---|---|
| `DATABASE_URL` | Sim | ZimaOS — já configurado |
| `REDIS_URL` | Sim | ZimaOS — após instalar Redis |
| `BETTER_AUTH_SECRET` | Sim | Gerar: `openssl rand -base64 32` |
| `BREVO_API_KEY` | Sim (email) | app.brevo.com → Settings → API Keys |
| `EMAIL_FROM_ADDRESS` | Sim (email) | Seu domínio verificado no Brevo |
| `ANTHROPIC_API_KEY` | Sim (NLP/IA) | console.anthropic.com |
| `TELEGRAM_BOT_TOKEN` | Sim (bot) | @BotFather no Telegram |
| `GOOGLE_CLIENT_ID/SECRET` | Não (OAuth) | console.cloud.google.com |
| `PLUGGY_*` | Fase 3 | pluggy.ai |
| `WHATSAPP_*` | Fase 2 | Meta Developer Portal |
