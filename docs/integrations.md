# Integrações

## Bots de mensageria (Telegram/WhatsApp) — **removidos**

**Status:** Removidos em 08/2026, substituídos pelo assistente de IA interno.

O bot do Telegram era funcional e o do WhatsApp chegou a ser implementado, mas ambos
foram retirados: dependiam de infraestrutura externa fora do controle do projeto (no caso
da Meta, verificação de negócio com CNPJ e ~2 semanas de espera) e tiravam o usuário de
dentro do produto. O assistente interno usa a mesma IA sobre os mesmos dados, sem
dependência externa.

O que saiu: `routes/bots/`, `lib/bot/`, `lib/ai/expense-parser.ts`,
`lib/ai/voice-transcriber.ts`, os workers `bot-messages` e `voice-transcription`, as
filas correspondentes, a dependência `grammy`, os models `BotConversation`/`BotMessage` e
as colunas de vínculo em `user_profiles`.

O que ficou de propósito: `transactions.source` e `notifications.channel` continuam
aceitando os valores `telegram`/`whatsapp` — linhas históricas seguem válidas. O
`ai_usage_logs.feature` também mantém `expense_parsing` e `voice_transcription`, para o
medidor de consumo em `/admin/ai` continuar somando o histórico.

Para recuperar o código: `git show 73c711c -- apps/api/src/routes/bots`.

---

## Open Finance Brasil

**Status:** Planejado — schema pronto, sem integração real

- **Custo:** Gratuito (Resolução Conjunta Bacen nº 1/2020)
- **Cobertura:** Itaú, Bradesco, Nubank, Santander, BB, Caixa, Inter, C6, XP e todos +5M clientes
- **Segurança:** OAuth2 PKCE — usuário nunca compartilha senha bancária
- **Registro:** RAIDIAM (`web.directory.openbankingbrasil.org.br`) — requer CNPJ, 4-12 semanas
- **Tokens:** access_token expira em 15min; refresh_token até 1 ano
- **mTLS:** certificado cliente exigido (obtido no RAIDIAM)

Schema já preparado: `OpenFinanceConsent`, `OpenFinanceAccount`. Quando aprovado, a ideia é preferir Open Finance Brasil sobre Pluggy para o mesmo banco (custo zero).

---

## Pluggy (Agregador Bancário)

**Status:** Implementado — `apps/api/src/lib/pluggy/client.ts`, `apps/api/src/routes/pluggy.ts` — **atrás de feature flag por custo mensal**

- `NEXT_PUBLIC_ENABLE_PLUGGY` (env do `apps/web`, default ausente/`false`): controla só a exibição do botão "Conectar Banco" na tela de Contas (`apps/web/components/accounts/connect-bank-button.tsx`). O código de integração (rotas, client, worker de sync) continua intacto e funcional — só fica invisível na UI até o custo deixar de ser um problema.
- Env vars: `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`
- Fluxo: `POST /api/pluggy/connect-token` → widget `pluggy-connect-sdk` no navegador → `onSuccess` chama `POST /api/pluggy/items` → cria/atualiza `FinancialAccount` por conta detectada → enfileira `open-finance-sync` (BullMQ)
- Webhook (`POST /api/webhooks/pluggy`): a Pluggy não assina o payload (sem HMAC); o handler valida o IP de origem e nunca confia no corpo — busca os dados reais de volta na API autenticada da Pluggy
- **Atenção a um bug já corrigido:** a API da Pluggy devolve o connect token no campo `accessToken` da resposta de `/connect_token`, não em `connectToken` (apesar do nome do endpoint) — ver `apps/api/src/lib/pluggy/client.ts`

---

## Groq (NLP / IA)

**Status:** Implementado — `apps/api/src/lib/ai/groq-client.ts`

**Modelos usados (configuráveis em runtime via `AiSettings`, editável em `/admin/ai`):**
- `openai/gpt-oss-120b` (default `textModel`) — assistente de IA, insights mensais, detecção de recorrências, forecast de orçamento, NL queries
- `qwen/qwen3.8-27b` (default `visionModel`) — leitura de cupom fiscal/NF-e por foto (multimodal, aceita imagem + JSON mode)

**⚠️ A Groq aposenta modelos com frequência.** Toda a família `llama-3.x` saiu do catálogo em 08/2026 e passou a responder `404` / `model_decommissioned` — o que derruba *todas* as features de IA de uma vez. Antes de acusar bug no código, confira os ids vigentes na conta:

```bash
curl -s https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY" | jq -r '.data[].id'
```

Os três ids são editáveis em `/admin/ai` sem deploy.

**Pontos de chamada:**
1. `lib/ai/financial-insights.ts` — insight mensal (worker `ai-analysis`)
2. `routes/ai.ts` (`POST /api/ai/query`) — NL query com tool calling
3. `lib/ai/category-suggester.ts` — sugestão de categoria
4. `lib/ai/receipt-parser.ts` — leitura de cupom fiscal (modelo de visão)

Cada chamada passa por `getAiSettings()` (kill-switch + modelo) e grava uso em `AiUsageLog` via `logAiUsage()`. `monthlyTokenLimit` (opcional) corta o uso quando excedido (`isWithinUsageLimit()`).

**Técnica:** `tool_use`/function calling com JSON schema estruturado para saída determinística. Prompt em PT-BR com contexto financeiro brasileiro, gírias, datas relativas ("ontem", "semana passada"), moeda BRL. Threshold de confiança: 0.7.

---

## Mercado Pago + Pix (Assinaturas)

**Status:** Implementado — `apps/api/src/lib/mercadopago.ts`, `apps/api/src/lib/pix.ts`

- **Assinaturas recorrentes:** `createSubscriptionCheckout()` cria um *preapproval* no Mercado Pago; o usuário paga pelo checkout hospedado; webhook (`POST /api/webhooks/mercadopago`) confirma e ativa o plano via `Subscription`.
- **Pix direto:** alternativa sem gateway — `buildPixPayload()` gera um BR Code (EMV QR Code) estático a partir da chave Pix cadastrada pelo admin; o pagamento é confirmado **manualmente** pelo admin em `/admin/checkouts` (`POST /api/admin/payment-events/:id/confirm-pix`), sem callback automático.
- **Configuração:** ambos os métodos (chaves, tokens, segredos) são guardados em `PaymentMethodConfig` (banco), editáveis em `/admin/payment-methods` — não mais só via `.env`. As variáveis `MERCADOPAGO_*` no `.env` funcionam como fallback.
- **Webhook idempotente:** todo evento recebido é gravado em `PaymentEvent` (`mpEventId` único) antes de processar, evitando duplicação.
- **Cancelamento:** `cancelSubscriptionAtMercadoPago()` é pulado quando `mpPreapprovalId` começa com `pix:` (assinatura paga via Pix não existe no Mercado Pago).
- Env vars: `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY`, `MERCADOPAGO_WEBHOOK_SECRET`

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
