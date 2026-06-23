# Setup de Desenvolvimento

## Pré-requisitos

- Node.js ≥ 20
- pnpm 11: `npm install -g pnpm@11`
- Docker Desktop (para Mailpit local)
- Tailscale conectado (para acessar PostgreSQL e Redis no ZimaOS)
- Conta no [Brevo](https://app.brevo.com/) para emails
- Conta na [Groq](https://console.groq.com/keys) para NLP/IA (free tier)
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

```bash
# Gerar cliente Prisma (obrigatório antes de rodar a API)
pnpm db:generate

# Criar e aplicar migration (precisa de conexão com o banco)
pnpm db:migrate

# Seed de categorias BR
pnpm db:seed
```

> **Atenção:** por rodar contra um banco compartilhado, mudanças de schema feitas durante o desenvolvimento deste projeto costumam ser aplicadas via script `.ts` temporário com `db.$executeRawUnsafe("ALTER TABLE ...")` em vez de `prisma migrate dev` — ver `docs/database.md`.

> **TimescaleDB**: depois da migration inicial, rodar no psql: `SELECT create_hypertable('transactions', 'date', if_not_exists => TRUE);`. Se TimescaleDB não estiver instalado, a tabela `transactions` funciona normalmente como PostgreSQL puro.

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

## 5. Rodar todos os apps

```bash
pnpm dev
# Web:    http://localhost:3000
# API:    http://localhost:3001
# Mobile: Expo Dev Server (QR code no terminal) — só scaffold, sem telas reais
```

No Windows, se precisar reiniciar só a API (ex: depois de um `prisma generate`), rode `pnpm --filter @finances/api dev` separadamente — o processo `tsx watch` mantém o Prisma Client em uso e pode bloquear a regeneração do client até ser encerrado.

## 6. Conta admin em dev

Defina `ADMIN_BOOTSTRAP="true"`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` no `.env` — ao subir a API, ela cria (ou garante `role: "admin"` em) essa conta automaticamente. Deixe `ADMIN_BOOTSTRAP="false"` em produção.

## 7. Pluggy em dev (opcional, tem custo)

A integração com a Pluggy está implementada mas escondida por trás de `NEXT_PUBLIC_ENABLE_PLUGGY` (no `apps/web/.env.local`) por causa do custo mensal. Para testar localmente, defina `NEXT_PUBLIC_ENABLE_PLUGGY="true"` e preencha `PLUGGY_CLIENT_ID`/`PLUGGY_CLIENT_SECRET`.

## Variáveis de Ambiente

| Variável | Obrigatória | Onde obter |
|---|---|---|
| `DATABASE_URL` | Sim | ZimaOS — já configurado |
| `REDIS_URL` | Sim | ZimaOS — após instalar Redis |
| `BETTER_AUTH_SECRET` | Sim | Gerar: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Sim | `http://localhost:3001` em dev |
| `AUTH_REQUIRE_EMAIL_VERIFICATION` | Não | `"false"` em dev, `"true"` em produção |
| `ADMIN_BOOTSTRAP` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Não | Cria conta admin automaticamente em dev |
| `BREVO_API_KEY` | Sim (email) | app.brevo.com → Settings → API Keys |
| `EMAIL_FROM_ADDRESS` | Sim (email) | Seu domínio verificado no Brevo |
| `GROQ_API_KEY` | Sim (NLP/IA) | console.groq.com/keys |
| `TELEGRAM_BOT_TOKEN` | Sim (bot) | @BotFather no Telegram |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Não (OAuth) | console.cloud.google.com |
| `PLUGGY_CLIENT_ID` / `PLUGGY_CLIENT_SECRET` | Não | pluggy.ai — só necessário com `NEXT_PUBLIC_ENABLE_PLUGGY=true` |
| `MERCADOPAGO_ACCESS_TOKEN` / `MERCADOPAGO_PUBLIC_KEY` / `MERCADOPAGO_WEBHOOK_SECRET` | Não | mercadopago.com.br/developers — fallback; pode ser configurado direto em `/admin/payment-methods` |
| `NEXT_PUBLIC_ENABLE_PLUGGY` | Não | `apps/web` — `"true"` para mostrar o botão de conexão bancária |
| `WHATSAPP_*` | Não | Meta Developer Portal — integração ainda não implementada |
