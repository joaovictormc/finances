# Próxima versão — correções e funcionalidades

Levantamento feito por leitura direta do código (não é uma lista de desejos genérica) — cada item abaixo foi conferido no projeto antes de entrar na lista. Organizado por prioridade.

> Revisado em 31/08/2026. A revisão anterior era anterior à remoção do bot Telegram/WhatsApp e ao assistente de IA; os itens que deixaram de existir foram removidos e os resolvidos foram para a seção ✅.

## 🔴 Bugs conhecidos (corrigir primeiro)

Nenhum aberto no momento.

## ✅ Resolvidos desde a última revisão

| Item | Como |
|---|---|
| Notificação não chegava no celular | Central completa no app (sino com contador na home, tela `/notifications` com marcar lida, limpar e navegação) **e** push de verdade via Expo: tabela `push_tokens` por aparelho, envio pelo `sendPushToUser` junto de cada `sendNotification`, e o toque no aviso abre a tela do assunto. O destino é traduzido de rota web pra rota do app em `lib/notification-links.ts` — a API grava `/overview`, o celular precisa de `/(tabs)`. |
| Notificações eram gravadas e nunca lidas | Nenhuma rota ou tela lia a tabela `Notification` — o único canal real era e-mail, e a linha só nascia quando o e-mail estava ligado, então quem desativou e-mail não recebia nada em canal nenhum. Agora o registro in-app é gravado sempre (`channel: "inapp"`) e o e-mail é entrega adicional; `GET/POST /api/notifications` alimenta uma campainha com contador na sidebar (desktop) e no cabeçalho (mobile web), com pop-up quando chega aviso novo. Cada aviso leva pra tela do assunto — o destino é gravado por quem emite (`link` em `metadata`), porque o tipo sozinho não resolve: `insight_ready` sai tanto do insight mensal (`/overview`) quanto da conta recorrente detectada (`/bills`). |
| Checkout Pix pendente passava despercebido | Varredura diária (`billing.worker.ts`, 9h) avisa o admin por e-mail quando um checkout Pix não confirmado entra na reta final (faltando 2 dias) ou vence, uma vez por estágio — a trava é o unique de `PaymentEvent.mpEventId`, não uma leitura anterior. A lista em `/admin/checkouts` ganhou selo de estado e esconde o botão de confirmar no vencido, em vez de deixá-lo levar `409`. |
| Assinatura paga nunca expirava | `getEffectivePlan` decidia só por `status`; `currentPeriodEnd` era gravado e exibido, mas nenhuma decisão de acesso o consultava. Como Pix não tem recorrência, um pagamento único valia pra sempre. Agora expira com 3 dias de carência (`isSubscriptionExpired`), e `currentPeriodEnd` nulo significa concessão manual do admin, que não expira. |
| Plano derivado do valor pago no webhook | `PLAN_BY_AMOUNT` era um literal `19.9/29.9` com fallback silencioso pra `pro` — mudança de preço, cupom ou proração rebaixava quem pagou `familia`. A fonte da verdade passou a ser o evento `checkout_created:{preapprovalId}`, com o preço real de `PLANS` como segundo caminho; sem conseguir justificar o plano, a assinatura **não** é ativada. |
| Idempotência do webhook com corrida | `findUnique` + `create` deixava dois webhooks simultâneos passarem juntos, e o guard de primeira ativação concedia a recompensa por indicação em dobro. Virou `create` com captura de `P2002`. |
| Checkout Pix confirmável para sempre | `confirm-pix` aceitava qualquer evento `pix_checkout_created`, de qualquer idade, numa lista que só crescia. Passou a recusar acima de 7 dias (`409`). |
| Checkouts sem rate limit | `/checkout` e `/checkout-pix` (10/15min por usuário) — cada chamada criava um preapproval no Mercado Pago e uma linha na fila do admin. |
| Assinatura HMAC comparada por string | `verifyMercadoPagoSignature` usa `timingSafeEqual` com checagem de tamanho. |
| Segredos de `PaymentMethodConfig` em texto plano no banco | Access token e webhook secret do Mercado Pago passaram a ser gravados com AES-256-GCM (`packages/db/src/crypto.ts`, formato marcado `enc:v1:`) e só são descriptografados na hora de falar com o gateway. Registro legado em texto puro continua legível e é convertido ao salvar ou pelo backfill `pnpm --filter @finances/api secrets:encrypt`. Sem `APP_ENCRYPTION_KEY` a rota recusa salvar (`503`) em vez de cair pra texto puro. |
| Colunas da grid de Transações não redimensionavam | Em `table-layout: fixed` quem define a coluna é o `<colgroup>` — `min-width`/`max-width` não valem em célula de tabela, e sem nenhuma coluna livre o navegador redistribui a sobra entre todas, desfazendo o arrasto. `transaction-list.tsx` passou a declarar as larguras no `colgroup`, com uma coluna vazia absorvendo a folga. |
| Import de extrato sem limite de tamanho | `validateImportFileBatch` aplicado em `/import` e `/import/batch` (extensão, 10 MB por arquivo, 50 MB e 20 arquivos por lote), com testes em `import-limits.test.ts`. |
| Webhook da Pluggy não rejeitava IP inesperado | `webhooks/pluggy.ts` agora responde `403` quando o `x-forwarded-for` existe e não é o IP da Pluggy (sem o header — dev local, sem proxy — segue passando, porque não há o que comparar). |
| Webhook do Telegram sem validação de secret | Deixou de existir: o bot Telegram/WhatsApp foi removido por completo. |
| Zero testes automatizados | 8 arquivos de teste, 62 casos: `pix` (CRC-16/CCITT-FALSE contra vetor publicado + estrutura EMV), `payment-methods` (mascaramento e criptografia em repouso dos segredos), `plan-limits` (gates de plano e expiração de assinatura), `notifications` (canal in-app x e-mail), `pix-checkout` (janela de confirmação e varredura de pendentes), `import-limits`, `bulk-categorize`, `report-period`. |
| Sem rate limiting | `lib/rate-limit.ts` (INCR/EXPIRE no Redis, falha aberta) aplicado em `/api/ai/query` (20/15min), `/api/assistant/conversations/:id/messages` (30/15min), `/api/transactions/receipt-scan` (20/15min) e `/import/batch` (10/15min). Login já tinha o rate limit do Better Auth. |
| Sem `not-found.tsx` / `error.tsx` | `app/not-found.tsx` (404 próprio) e `app/(dashboard)/error.tsx` (boundary do dashboard inteiro; `overview/error.tsx` continua valendo por ser mais específico). `loading.tsx` já existia em 19 rotas. |
| `console.log` de debug em produção | Os 5 logs do fluxo Pluggy em `connect-bank-button.tsx` foram removidos; não sobrou nenhum `console.log` em `apps/web` nem em `apps/mobile` (os `console.error` de erro real ficaram). |
| Sem 2FA | `twoFactor()` habilitado em `lib/auth.ts` — TOTP por app autenticador + códigos de backup, sem SMS/email OTP. |
| Política de senha não verificada | `minPasswordLength` configurado explicitamente em `lib/auth.ts:56`. |
| Flags de cookie não explícitas | `lib/auth.ts:147-150` define `httpOnly`, `sameSite: "lax"` e `useSecureCookies` atrelado ao protocolo real da `baseURL`. |
| Assistente sem histórico no mobile | A aba IA passou a ter lista de conversas (abrir, excluir, nova) e escolha de agente na criação — antes os agentes criados no celular só funcionavam na web. |
| Mobile era só scaffold | `apps/mobile` hoje é um app completo: 6 abas, transações, orçamentos, contas, metas, recompensas, leitura de cupom por foto e assistente de IA. |

## 🟠 Lacunas estruturais

| Item | Detalhe |
|---|---|
| **Testes só de unidade** | Os 62 casos cobrem funções puras e quatro módulos com banco mockado. Nenhuma rota Hono é exercida ponta a ponta, e os workers de fila (`jobs/workers/*`) não têm teste nenhum. O próximo degrau natural é um teste de rota com o app Hono em memória. |
| **Web ainda sem push do navegador** | No celular o push já existe (Expo). Na web a campainha consulta a cada 60s e ao voltar pra aba, então um aviso pode demorar até um minuto. Suficiente pros avisos diários de hoje, insuficiente se algum dia houver aviso que precise chegar na hora. |
| **Sem `global-error.tsx`** | O boundary novo cobre o dashboard, mas um erro dentro do próprio `app/layout.tsx` ainda cai na tela genérica do Next. |
| **Bibliotecas pesadas sem carregamento sob demanda** | `recharts` (gráficos) e `react-day-picker` (filtro de período) entram no bundle inicial de qualquer página que as usa. Nenhum componente do app usa `next/dynamic` hoje — confirmado por busca. |

## 🟡 Funcionalidades planejadas, nunca iniciadas

- **Open Finance Brasil via RAIDIAM** — `OpenFinanceConsent`/`OpenFinanceAccount` no schema, sem integração real (hoje só Pluggy).
- ~~WhatsApp Business API~~ — **cancelado**: substituído pelo assistente de IA interno (`/api/assistant`), por decisão registrada em `docs/ajustes-pos-teste.md`.
- ~~Auto-categorização de transações importadas~~ — **resolvido por decisão de produto**: a escolha foi sugerir, nunca categorizar sozinho (`POST /api/transactions/suggest-categories` + conciliação em massa).

## 🟢 Candidatos a nova funcionalidade (a validar antes de virar spec)

Estes **não foram pedidos** — são lacunas observadas durante o desenvolvimento. Cada um precisaria de brainstorming antes de virar trabalho:

- **Exportar transações para CSV/Excel** (hoje só existe import) — útil pra levar os dados pra outra ferramenta ou pro contador.
- **Filtro de débito/crédito na tela de Transações** — o campo `paymentMethod` existe desde a Fase 8, mas não há filtro dedicado.
- **Reativar conta arquivada** (hoje só arquivar e excluir definitivamente).
- **Lembrete automático de conta desatualizada** — útil se o usuário parar de importar extrato por um tempo.

## 🔒 Segurança geral para o usuário

| Item | Detalhe |
|---|---|
| Confirmação de Pix é 100% manual, sem conferência de valor | O admin confirma no olho em `/admin/checkouts`; nada verifica que o Pix daquele `txid` entrou, nem o valor. É o desenho do método (`Pix direto` = conciliação manual). O aviso de vencimento já existe; o passo que falta é conferir o recebimento de fato — consultar a conta recebedora (API do PSP) ou, no mínimo, exigir que o admin confirme o valor esperado. |
| Cancelamento derruba o acesso na hora | `getEffectivePlan` trata `status != "active"` como free, então cancelar no meio do período pago encerra o acesso imediatamente. A tela de cobrança prometia o contrário; o texto foi corrigido, mas a decisão de produto (encerrar na hora × manter até `currentPeriodEnd`) continua em aberto. |
| Sem alerta de novo login / dispositivo desconhecido | `Session` guarda `ipAddress`/`userAgent`, mas nada notifica o usuário quando um login acontece de um dispositivo ou local novo. |

## 🕵️ Mascaramento de código pelo DevTools

Importante alinhar expectativa: **qualquer aplicação web entrega JS pro navegador do usuário — não existe forma de impedir 100% a inspeção do código-fonte no DevTools.** O estado atual:

| Item | Detalhe |
|---|---|
| `console.log` de debug | Resolvido — nenhum restante em `apps/web`/`apps/mobile`. |
| Source maps de produção | `productionBrowserSourceMaps` não está definido em `next.config.ts`, ou seja, fica no padrão do Next (desligado). Vale declarar explicitamente se a intenção for travar isso. |
| Chaves/segredos no bundle do cliente | Conferido: variáveis sensíveis (`GROQ_API_KEY`, `MERCADOPAGO_ACCESS_TOKEN`, etc.) só existem no `.env` da API, nunca como `NEXT_PUBLIC_*`. Manter essa disciplina ao adicionar integrações — qualquer `NEXT_PUBLIC_*` é visível no DevTools por definição. |
| Minificação/ofuscação | O build de produção já minifica (SWC); ofuscação adicional tem retorno baixo pro esforço — não é prioridade. |

## ⚡ Velocidade e renderização

| Item | Onde | Detalhe |
|---|---|---|
| Bibliotecas pesadas carregadas de forma síncrona | `recharts`, `react-day-picker` | Carregar via `next/dynamic({ ssr: false })` reduziria o JS inicial da Visão Geral e da tela de Transações. |
| `<img>` nativa em vez de `next/image` | `apps/web/components/ui/category-icon.tsx` | Ícones de categoria enviados pelo usuário não passam pela otimização/lazy-loading do Next. Baixo impacto hoje (ícones pequenos). |
| Lista de transações sem virtualização | `apps/web/components/transactions/transaction-list.tsx` | A paginação limita a 20-100 itens por página, então não é crítico — mas vira problema se o limite subir. |

## Como usar este documento

Antes de iniciar qualquer item da seção 🟢, ou qualquer mudança de comportamento nos itens 🔴/🟠, seguir o fluxo já estabelecido neste projeto: brainstorming → spec em `docs/superpowers/specs/` → plano → implementação.
