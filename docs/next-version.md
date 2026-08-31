# Próxima versão — correções e funcionalidades

Levantamento feito por leitura direta do código (não é uma lista de desejos genérica) — cada item abaixo foi conferido no projeto antes de entrar na lista. Organizado por prioridade.

> Revisado em 31/08/2026. A revisão anterior era anterior à remoção do bot Telegram/WhatsApp e ao assistente de IA; os itens que deixaram de existir foram removidos e os resolvidos foram para a seção ✅.

## 🔴 Bugs conhecidos (corrigir primeiro)

| Item | Onde | Detalhe |
|---|---|---|
| Colunas da grid de Transações não redimensionam de forma confiável | `apps/web/components/transactions/transaction-list.tsx` | Resize ainda falha em alguns casos mesmo após as correções de hidratação e largura fixa da Fase 8. Precisa de uma nova rodada de diagnóstico — possivelmente trocar a abordagem (lib de tabela como `@tanstack/table` em vez de resize manual). **Não foi reverificado na revisão de 31/08.** |

## ✅ Resolvidos desde a última revisão

| Item | Como |
|---|---|
| Import de extrato sem limite de tamanho | `validateImportFileBatch` aplicado em `/import` e `/import/batch` (extensão, 10 MB por arquivo, 50 MB e 20 arquivos por lote), com testes em `import-limits.test.ts`. |
| Webhook da Pluggy não rejeitava IP inesperado | `webhooks/pluggy.ts` agora responde `403` quando o `x-forwarded-for` existe e não é o IP da Pluggy (sem o header — dev local, sem proxy — segue passando, porque não há o que comparar). |
| Webhook do Telegram sem validação de secret | Deixou de existir: o bot Telegram/WhatsApp foi removido por completo. |
| Zero testes automatizados | 6 arquivos de teste, 27 casos: `pix` (CRC-16/CCITT-FALSE contra vetor publicado + estrutura EMV), `payment-methods` (mascaramento de segredos), `plan-limits` (gates de plano com o banco mockado), `import-limits`, `bulk-categorize`, `report-period`. |
| Sem rate limiting | `lib/rate-limit.ts` (INCR/EXPIRE no Redis, falha aberta) aplicado em `/api/ai/query` (20/15min), `/api/assistant/conversations/:id/messages` (30/15min), `/api/transactions/receipt-scan` (20/15min) e `/import/batch` (10/15min). Login já tinha o rate limit do Better Auth. |
| Sem `not-found.tsx` / `error.tsx` | `app/not-found.tsx` (404 próprio) e `app/(dashboard)/error.tsx` (boundary do dashboard inteiro; `overview/error.tsx` continua valendo por ser mais específico). `loading.tsx` já existia em 19 rotas. |
| `console.log` de debug em produção | Os 5 logs do fluxo Pluggy em `connect-bank-button.tsx` foram removidos; não sobrou nenhum `console.log` em `apps/web` nem em `apps/mobile` (os `console.error` de erro real ficaram). |
| Sem 2FA | `twoFactor()` habilitado em `lib/auth.ts` — TOTP por app autenticador + códigos de backup, sem SMS/email OTP. |
| Política de senha não verificada | `minPasswordLength` configurado explicitamente em `lib/auth.ts:56`. |
| Flags de cookie não explícitas | `lib/auth.ts:147-150` define `httpOnly`, `sameSite: "lax"` e `useSecureCookies` atrelado ao protocolo real da `baseURL`. |
| Mobile era só scaffold | `apps/mobile` hoje é um app completo: 6 abas, transações, orçamentos, contas, metas, recompensas, leitura de cupom por foto e assistente de IA. |

## 🟠 Lacunas estruturais

| Item | Detalhe |
|---|---|
| **Testes só de unidade** | Os 27 casos cobrem funções puras e um módulo com banco mockado. Nenhuma rota Hono é exercida ponta a ponta, e os workers de fila (`jobs/workers/*`) não têm teste nenhum. O próximo degrau natural é um teste de rota com o app Hono em memória. |
| **Sem `global-error.tsx`** | O boundary novo cobre o dashboard, mas um erro dentro do próprio `app/layout.tsx` ainda cai na tela genérica do Next. |
| **Bibliotecas pesadas sem carregamento sob demanda** | `recharts` (gráficos) e `react-day-picker` (filtro de período) entram no bundle inicial de qualquer página que as usa. Nenhum componente do app usa `next/dynamic` hoje — confirmado por busca. |

## 🟡 Funcionalidades planejadas, nunca iniciadas

- **Open Finance Brasil via RAIDIAM** — `OpenFinanceConsent`/`OpenFinanceAccount` no schema, sem integração real (hoje só Pluggy).
- ~~WhatsApp Business API~~ — **cancelado**: substituído pelo assistente de IA interno (`/api/assistant`), por decisão registrada em `docs/ajustes-pos-teste.md`.
- ~~Auto-categorização de transações importadas~~ — **resolvido por decisão de produto**: a escolha foi sugerir, nunca categorizar sozinho (`POST /api/transactions/suggest-categories` + conciliação em massa).

## 🟢 Candidatos a nova funcionalidade (a validar antes de virar spec)

Estes **não foram pedidos** — são lacunas observadas durante o desenvolvimento. Cada um precisaria de brainstorming antes de virar trabalho:

- **Lista de conversas do assistente no mobile** — hoje cada abertura da aba "IA" começa uma conversa nova; o histórico só é navegável pela web. É a pendência conhecida do recurso que acabou de entrar.
- **Exportar transações para CSV/Excel** (hoje só existe import) — útil pra levar os dados pra outra ferramenta ou pro contador.
- **Filtro de débito/crédito na tela de Transações** — o campo `paymentMethod` existe desde a Fase 8, mas não há filtro dedicado.
- **Reativar conta arquivada** (hoje só arquivar e excluir definitivamente).
- **Lembrete automático de conta desatualizada** — útil se o usuário parar de importar extrato por um tempo.

## 🔒 Segurança geral para o usuário

| Item | Detalhe |
|---|---|
| Segredos de `PaymentMethodConfig` em texto plano no banco | `config` (JSON) guarda `accessToken`/chave Pix sem criptografia em repouso — só é mascarado na resposta da API (`maskSecrets()`, agora coberto por teste), não no banco. `packages/db/src/crypto.ts` (AES-256-GCM) já existe e é usado em `OpenFinanceConsent.accessTokenEnc`; falta aplicar aqui. |
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
