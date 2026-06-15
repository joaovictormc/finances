# Integrações

## Telegram Bot (grammy)

**Status:** Implementado — `apps/api/src/routes/bots/telegram.ts`

**Configuração:**
1. Criar bot via @BotFather no Telegram → copiar token
2. Definir `TELEGRAM_BOT_TOKEN` no `.env`
3. Setar webhook: `POST https://api.telegram.org/bot<TOKEN>/setWebhook?url=<API_URL>/api/bots/telegram`

**Comandos disponíveis:**
- `/start` — gera código de vinculação one-time (Redis, TTL 10min)
- `/ajuda` — lista de exemplos de uso
- `/resumo` — resumo financeiro do mês corrente

**Registro de gastos via NLP:**
```
Usuário: "gastei 50 reais no mercado hoje"
Bot: "💸 Gasto detectado:
      💵 Valor: R$ 50,00
      📁 Categoria: Supermercado
      📅 Data: 14/06/2025
      [✅ Confirmar] [✏️ Editar] [❌ Cancelar]"
```

**Pipeline NLP:**
1. Webhook recebe mensagem → enfileira em `bot-messages` (BullMQ)
2. Worker chama `parseExpenseMessage()` → Claude Haiku (`claude-haiku-4-5-20251001`)
3. Se confiança ≥ 0.7: cria transação pendente em Redis (TTL 5min) + envia confirmação
4. Usuário confirma → worker cria `Transaction` no banco

**Rate limits:** 30 msg/seg global, 1 msg/seg por chat.

---

## WhatsApp Business API (Meta)

**Status:** Planejado — Fase 2

- Free tier: 1.000 conversas/mês (janela de 24h por conversa)
- Aprovação: ~2 semanas (Business Verification com CNPJ)
- Env vars: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- Webhook: `POST /api/bots/whatsapp` (a implementar)
- Atenção: mídia de áudio disponível apenas por 30s após webhook — download imediato obrigatório

---

## Open Finance Brasil

**Status:** Planejado — Fase 3 (paralelo ao Pluggy)

- **Custo:** Gratuito (Resolução Conjunta Bacen nº 1/2020)
- **Cobertura:** Itaú, Bradesco, Nubank, Santander, BB, Caixa, Inter, C6, XP e todos +5M clientes
- **Segurança:** OAuth2 PKCE — usuário nunca compartilha senha bancária
- **Registro:** RAIDIAM (`web.directory.openbankingbrasil.org.br`) — requer CNPJ, 4-12 semanas
- **Tokens:** access_token expira em 15min; refresh_token até 1 ano
- **mTLS:** certificado cliente exigido (obtido no RAIDIAM)

Schema já preparado: `OpenFinanceConsent`, `OpenFinanceAccount`.

---

## Pluggy (Agregador Bancário para MVP)

**Status:** Planejado — Fase 3

- **Custo:** Gratuito até 100 conexões/mês (MVP sem aprovação regulatória)
- **Vantagem:** Sem necessidade de registro no RAIDIAM para começar
- Env vars: `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`
- Endpoint: Pluggy Connect widget embedded na web
- Migração: quando OFB aprovado, preferir OFB sobre Pluggy para o mesmo banco

---

## Claude API (Anthropic)

**Status:** Implementado

**Modelos usados:**
- `claude-haiku-4-5-20251001` — parsing de gastos em PT-BR (rápido, barato, real-time)
- `claude-sonnet-4-6` — insights mensais, NL queries (mais inteligente, usado em batch)

**Arquivo:** `apps/api/src/lib/ai/expense-parser.ts`

**Técnica:** `tool_use` com JSON schema estruturado para saída determinística.

**Prompt:** Sistema em PT-BR com contexto financeiro brasileiro, gírias, datas relativas ("ontem", "semana passada"), moeda BRL.

**Threshold de confiança:** 0.7 — abaixo disso, bot pede esclarecimento.

---

## Brevo (Email Transacional)

**Status:** Implementado — `apps/api/src/lib/email.ts`

- **Free tier:** 300 emails/dia (~9.000/mês)
- **SDK:** `@getbrevo/brevo`
- **Env vars:** `BREVO_API_KEY`, `EMAIL_FROM_ADDRESS`
- **Templates:** React Email components em `apps/api/src/emails/`
  - `email-verification.tsx` — verificação de conta
  - `welcome.tsx` — boas-vindas
  - `bill-reminder.tsx` — lembrete de contas a pagar
  - `budget-alert.tsx` — alerta de orçamento ultrapassado
- **Arquitetura:** Envio **sempre assíncrono** via BullMQ — nunca síncrono no handler da request
