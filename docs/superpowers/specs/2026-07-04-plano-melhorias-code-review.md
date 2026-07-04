# Plano de melhorias — code review pós roadmap de segurança/design/IA/configurações

## Contexto

Revisão de todo o trabalho implementado entre 2026-07-02 e 2026-07-04 (Fases
1-9 do roadmap `2026-07-02-seguranca-design-ia-configuracoes.md`, mais o
recurso de esqueci/trocar senha e o checklist de design da Parte B), usando
a skill `code-review` em effort alto: 8 ângulos de busca (line-by-line,
comportamento removido, rastreamento cross-file, reuso, simplificação,
eficiência, altitude, convenções), gerando ~50 candidatos, verificados um a
um contra o código real e o código-fonte do `better-auth` em
`node_modules`. 9 achados sobreviveram à verificação (nenhum bug crítico
bloqueante). Este documento organiza esses achados como plano de correção,
priorizado por severidade e com foco extra no backend (performance e
segurança), conforme pedido.

## Prioridade 1 — Segurança (backend)

### 1.1 Rate limit do login mais fraco do que o pretendido

**Arquivo:** `apps/api/src/lib/auth.ts:158`

**Problema:** O `rateLimit.customRules["/sign-in/email"]` adicionado pra
corrigir o bug de "Too many requests" **substitui** a regra especial
embutida do better-auth pra `/sign-in*` (3 tentativas/10s) em vez de
coexistir com ela — confirmado lendo `resolveRateLimitConfig` no pacote
`better-auth`: a regra especial é aplicada primeiro, depois `customRules`
sobrescreve `currentWindow`/`currentMax` sem comparar com a regra mais
rígida. O resultado prático é 15 tentativas/60s no endpoint de login mais
atacado do app, uma redução real de ~5x na proteção contra força bruta.

**Correção sugerida:** Escolher um valor que resolva o falso-positivo (login
manual + 2FA) sem abrir mão de tanta proteção — por exemplo `window: 30,
max: 6` (dobra a janela original mantendo a ordem de grandeza), ou
implementar a regra como uma função em `customRules` que recebe a regra
atual e retorna o mais rígido entre os dois em vez de um valor fixo.

### 1.2 Cookie `Secure` pode não ativar em produção

**Arquivo:** `apps/api/src/lib/auth.ts:144`

**Problema:** `advanced.useSecureCookies: process.env.NODE_ENV ===
"production"` substituiu a heurística automática do better-auth (que
derivava `secure` do protocolo da própria `baseURL`/request). Não há
Dockerfile, script de deploy ou `ecosystem.config` no repo que garanta
`NODE_ENV=production` — o script de start da API é um `node dist/index.js`
puro. Se essa variável não estiver definida no ambiente real de produção
(rodando atrás de HTTPS), o cookie de sessão perde o atributo `Secure`
silenciosamente.

**Correção sugerida:** Confirmar como o processo de deploy real define
`NODE_ENV` (verificar com o time de infra/hosting) e, se não houver
garantia, trocar para uma checagem baseada no protocolo de `API_URL`
(`API_URL.startsWith("https://")`) em vez do nome da env var — mais perto
do comportamento implícito anterior, porém explícito no código.

## Prioridade 2 — Performance (backend)

### 2.1 Exportação LGPD sem paginação/limite

**Arquivo:** `apps/api/src/routes/user.ts:17-71`

**Problema:** O endpoint `GET /api/user/export` roda ~16 queries em
paralelo via `Promise.all`, várias sem limite algum
(`transaction.findMany`, `notification.findMany`,
`botConversation.findMany` com `include: { messages: true }`). Pra um
usuário com anos de histórico, isso carrega tudo em memória e serializa em
JSON de uma vez, com risco de travar o event loop e estourar memória.

**Correção sugerida:** Adicionar `take`/paginação ou um corte por data (ex:
últimos N anos, com nota no JSON de que dados mais antigos podem ser
solicitados à parte), ou gerar o export como um job assíncrono (fila) que
notifica o usuário quando o arquivo estiver pronto para download, em vez de
processar tudo síncrono na request.

### 2.2 Notificações enviadas em série (email → Telegram)

**Arquivo:** `apps/api/src/lib/notifications.ts:26-83`

**Problema:** `sendNotification()` executa o canal de email (criar → enviar
→ atualizar status) e só depois o canal de Telegram, sequencialmente, em
vez de rodar os dois em paralelo. Confirmado que isso se acumula: `budget-
forecast.ts` chama `sendNotification` dentro de um loop por orçamento
estourado/membro de grupo, multiplicando a latência extra pelo tamanho do
lote.

**Correção sugerida:** Rodar os blocos de email e Telegram com
`Promise.allSettled` em vez de sequencialmente (cada canal já é
independente — uma falha num não deve bloquear o outro, o que também
corrige um problema de resiliência de quebra).

## Prioridade 3 — Correção / integridade de dados

### 3.1 Restrição de forma de pagamento "crédito" só existe no client

**Arquivos:** `apps/web/components/transactions/transaction-form.tsx:73`,
`packages/validations/src/transaction.schema.ts`,
`apps/api/src/routes/transactions.ts`

**Problema:** O `useEffect` que impede escolher `paymentMethod: "credit"`
numa conta sem `hasCreditCard` só existe nas telas (web e mobile). O schema
zod valida apenas o enum de 5 valores, sem regra cruzada com a conta; a
rota da API grava o que vier validado sem checar `hasCreditCard`. Uma
chamada direta à API (ou uma corrida de estado antes do efeito rodar)
grava uma transação inconsistente.

**Correção sugerida:** Adicionar um `.refine()` no schema de criação/edição
de transação que rejeita `paymentMethod: "credit"` sem confirmar
`hasCreditCard` da conta (requer buscar a conta antes de validar, então
provavelmente fica melhor como uma checagem explícita na rota, não no zod
puro) — ex: no handler de `POST /api/transactions` e `PATCH
/api/transactions/:id`, buscar a conta e rejeitar com 400 se
`paymentMethod === "credit" && !account.hasCreditCard`.

### 3.2 Toggle de notificação não desfaz em caso de erro

**Arquivos:** `apps/web/app/(dashboard)/settings/page.tsx:45`,
`apps/mobile/app/settings.tsx`

**Problema:** `updatePref()` atualiza o estado local otimisticamente antes
do `PATCH`. Se a requisição falhar, o toggle continua "aceso" visualmente
sem ter sido salvo — não há rollback nem novo `GET` automático (o
comentário no mobile diz que "o próximo GET corrige o estado", mas nenhum
GET é disparado depois da falha).

**Correção sugerida:** No `catch` do `updatePref`, reverter o estado local
pro valor anterior (guardar o valor antigo antes do set otimista) além de
mostrar o toast/erro já existente no web (o mobile nem toast tem hoje).

### 3.3 Destructuring posicional frágil no export

**Arquivo:** `apps/api/src/routes/user.ts:17`

**Problema:** As 17 variáveis do export são desestruturadas por posição de
um array de 17 queries em `Promise.all`. Uma reordenação futura sem ajustar
a lista de nomes na mesma posição realoca dados silenciosamente — o
TypeScript não pega o erro porque cada variável só é re-inferida pro tipo
que estiver naquela posição.

**Correção sugerida:** Trocar por um objeto nomeado (`Promise.all` de pares
`[chave, promise]` reduzido a um objeto, ou simplesmente várias
`const x = await db.x.findMany(...)` — não precisa ser paralelo se a
query em si já for rápida o bastante, ou usar `Promise.all` mantendo o
resultado como objeto via `Object.fromEntries`).

## Prioridade 4 — Manutenção / duplicação (baixo risco, cleanup)

### 4.1 Tamanho mínimo de senha duplicado

**Arquivos:** `apps/api/src/lib/auth.ts:55` (`minPasswordLength: 8`),
`packages/validations/src/password.schema.ts` (`.min(8, ...)`)

**Correção sugerida:** Importar uma constante compartilhada (ex:
`MIN_PASSWORD_LENGTH` exportada de `@finances/validations`) nos dois
lugares, em vez de repetir o número `8`.

### 4.2 Forma de pagamento reescrita à mão em ~6 arquivos

**Arquivos:** `apps/web/lib/types.ts`, `apps/mobile/lib/types.ts`,
`apps/web/components/transactions/transaction-form.tsx`,
`apps/mobile/lib/payment-methods.ts`,
`apps/web/components/transactions/transaction-list.tsx`,
`apps/web/components/overview/recent-transactions.tsx`

**Correção sugerida:** Derivar o union type de `PaymentMethodSchema` (zod)
em vez de retipar à mão, e centralizar o mapa de emoji/label
(`PAYMENT_METHOD_BADGE`) num único lugar em `@finances/validations` ou
`packages/validations`, importado pelos três lugares que hoje têm cópias
próprias.

## Ordem de execução sugerida

1 → 2 (segurança do backend, rápido e direto)
3 → 4 (performance do backend)
5 → 7 (correção/integridade)
6 (bug de UX, rápido)
8 → 9 (cleanup, sem pressa, pode ficar por último ou ser pulado)

## Verificação

A cada ajuste: `pnpm --filter @finances/api typecheck` /
`pnpm --filter @finances/web typecheck` / `pnpm --filter @finances/mobile
typecheck`. Para 1.1 e 1.2, testar manualmente o rate limit (várias
tentativas de login) e inspecionar o header `Set-Cookie` em produção/staging
real. Para 2.1, testar o export numa conta com bastante histórico. Para 3.1,
tentar criar uma transação com `paymentMethod: "credit"` via chamada direta
à API numa conta sem cartão de crédito e confirmar que a API rejeita.
