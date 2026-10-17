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

## IA: Groq, Claude e Ollama Cloud

**Status:** Implementado — camada única em `apps/api/src/lib/ai/chat.ts`

Três funções, cada uma com provedor e modelo escolhidos em `/admin/ai` (`AiSettings`):

| Função | Campos | Usada por |
|---|---|---|
| Texto | `textProvider` / `textModel` | insight mensal, pergunta avulsa (`POST /api/ai/query`), sugestão de categoria |
| Imagem | `visionProvider` / `visionModel` | leitura de cupom fiscal (precisa de modelo que aceite imagem) |
| Assistente | `assistantProvider` / `assistantModel` | conversa com histórico e ferramentas (`/api/assistant`) |

**Provedores** (`lib/ai/providers.ts`):
- **Groq** e **Ollama Cloud** pelo endpoint compatível com OpenAI (`https://api.groq.com/openai/v1`, `https://ollama.com/v1`).
- **Claude** pela Messages API da Anthropic (`https://api.anthropic.com/v1`). O adaptador converte system, ferramentas (`tool_use`/`tool_result`) e imagem (base64); o modo JSON vira instrução no system.

**Chaves** (`lib/ai/credentials.ts`): cadastradas em `/admin/ai`, validadas listando os modelos antes de gravar e guardadas criptografadas (`AiProviderCredential`, `APP_ENCRYPTION_KEY`). Sem chave no painel, vale a do `.env` (`GROQ_API_KEY`, `ANTHROPIC_API_KEY`, `OLLAMA_API_KEY`). A chave nunca volta para a tela, só o final mascarado.

**Modelos gratuitos primeiro:** nenhum provedor informa pela API se um modelo é gratuito. A classificação em `providers.ts` vem das páginas de preço: Groq libera todos no plano Free (com limite), Claude é todo pago, e na Ollama só conta como gratuito o que estiver em `OLLAMA_FREE_MODELS` (a Ollama não publica a lista do plano Free).

**⚠️ Provedores aposentam modelos.** A família `llama-3.x` saiu da Groq em 08/2026 e passou a responder `404` / `model_decommissioned`. Em `/admin/ai`, "Atualizar modelos" busca a lista vigente da chave.

**Custo:** `lib/ai/pricing.ts` tem preço por provedor e modelo (mantido à mão). Modelo sem preço aparece como "preço não cadastrado" e o total vira um piso. `AiUsageLog` grava provedor e modelo de cada chamada; `monthlyTokenLimit` corta o uso quando excedido.

---

## Mercado Pago + Pix (Assinaturas)

**Status:** Implementado — `apps/api/src/lib/mercadopago.ts`, `apps/api/src/lib/pix.ts`

- **Assinaturas recorrentes:** `createSubscriptionCheckout()` cria um *preapproval* no Mercado Pago; o usuário paga pelo checkout hospedado; webhook (`POST /api/webhooks/mercadopago`) confirma e ativa o plano via `Subscription`.
- **Pix direto:** alternativa sem gateway — `buildPixPayload()` gera um BR Code (EMV QR Code) estático a partir da chave Pix cadastrada pelo admin; o pagamento é confirmado **manualmente** pelo admin em `/admin/checkouts` (`POST /api/admin/payment-events/:id/confirm-pix`), sem callback automático.
- **Configuração:** ambos os métodos (chaves, tokens, segredos) são guardados em `PaymentMethodConfig` (banco), editáveis em `/admin/payment-methods` — não mais só via `.env`. As variáveis `MERCADOPAGO_*` no `.env` funcionam como fallback.
- **Webhook idempotente:** todo evento recebido é gravado em `PaymentEvent` (`mpEventId` único) antes de processar, evitando duplicação.
- **Renovação:** o Mercado Pago **não** reemite `subscription_preapproval` a cada cobrança recorrente — o preapproval segue `authorized` e o que chega é `subscription_authorized_payment`. O webhook trata esse evento (`applyRecurringPayment`), consulta a invoice, e só avança `currentPeriodEnd` se `payment.status === "approved"`. O tamanho do período sai do `auto_recurring` do próprio preapproval, então plano semestral ou anual já vale o tempo certo.
  - ⚠️ **Exige que o evento esteja marcado no painel do Mercado Pago** (Suas integrações → Webhooks → *Pagamentos de assinatura*). Sem essa assinatura o evento nunca chega e o período para de avançar: quem continua pagando perde o plano no primeiro vencimento.
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
