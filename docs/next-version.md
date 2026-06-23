# Próxima versão — correções e funcionalidades

Levantamento feito por leitura direta do código (não é uma lista de desejos genérica) — cada item abaixo foi confirmado no projeto antes de entrar na lista. Organizado por prioridade.

## 🔴 Bugs conhecidos (corrigir primeiro)

| Item | Onde | Detalhe |
|---|---|---|
| Colunas da grid de Transações não redimensionam de forma confiável | `apps/web/components/transactions/transaction-list.tsx` | Resize ainda falha em alguns casos mesmo após as correções de hidratação e largura fixa desta sessão (Fase 8). Precisa de uma nova rodada de diagnóstico — possivelmente trocar a abordagem (lib de tabela como `@tanstack/table` em vez de resize manual). |
| Import de extrato sem limite de tamanho de arquivo | `apps/api/src/routes/transactions.ts` (`POST /import`) | O endpoint lê o arquivo inteiro em memória (`file.text()`) sem checar `Content-Length`/tamanho — um arquivo muito grande pode degradar a API. Adicionar limite (ex: 5MB) e retornar 413 antes de processar. |
| Webhook da Pluggy não rejeita IP inesperado | `apps/api/src/routes/webhooks/pluggy.ts` | Hoje só loga um `console.warn` quando o IP de origem não é o da Pluggy, mas **continua processando o evento**. Não é crítico (o handler nunca confia no corpo, sempre busca dados reais na API autenticada), mas permite que qualquer um force ressincronizações falsas. Trocar o warn por um `return c.json(..., 403)`. |
| Webhook do Telegram sem validação de secret token | `apps/api/src/routes/bots/telegram.ts` | Não valida o header `X-Telegram-Bot-Api-Secret-Token`. Qualquer pessoa que descubra a URL do webhook pode enviar updates falsos pro bot. Telegram suporta configurar um `secret_token` no `setWebhook` — fácil de adicionar. |

## 🟠 Lacunas estruturais

| Item | Detalhe |
|---|---|
| **Zero testes automatizados** | `vitest` está configurado em `apps/api` (`pnpm test` → `vitest run`) mas não existe nenhum arquivo `*.test.ts` no projeto inteiro. Recomendo começar pelos pontos de maior risco: `lib/pix.ts` (cálculo de CRC16/payload Pix — erro aqui gera cobrança errada), `lib/payment-methods.ts` (mascaramento de segredos), `lib/plan-limits.ts` (gates de plano). |
| **Sem rate limiting** | Nenhuma rota da API tem limitação de requisições (nem login, nem o webhook do bot, nem `/api/ai/query`). Login por força bruta e abuso de IA (custo) são os riscos mais diretos. |
| **Sem `error.tsx`/`not-found.tsx`/`loading.tsx`** | Nenhuma página do Next.js tem esses arquivos especiais — erro não tratado em uma página do dashboard cai na tela de erro genérica do Next, e rotas inexistentes não têm 404 customizado. |
| **Mobile (`apps/mobile`) é só scaffold** | Sem nenhuma tela real além do `(tabs)/index.tsx` inicial — decidir se entra no roadmap ou se o app vira só web/PWA. |

## 🟡 Funcionalidades planejadas, nunca iniciadas

Já documentadas em `docs/features.md`, listadas aqui por completude:

- **WhatsApp Business API** — schema e variáveis de ambiente prontos, zero código de rota/webhook.
- **Open Finance Brasil via RAIDIAM** — `OpenFinanceConsent`/`OpenFinanceAccount` no schema, sem integração real (hoje só Pluggy).
- **Auto-categorização de transações importadas/sincronizadas** — hoje toda transação de import/Pluggy entra sem categoria; só a categorização manual ou via bot (texto/voz) passa por IA.

## 🟢 Candidatos a nova funcionalidade (a validar com o usuário antes de entrar em qualquer spec)

Estes **não foram pedidos** — são sugestões baseadas em lacunas observadas durante o desenvolvimento desta sessão. Cada um precisaria passar por brainstorming antes de virar trabalho:

- **Exportar transações para CSV/Excel** (hoje só existe import, não export) — útil pra quem quer levar os dados pra outra ferramenta ou contador.
- **Filtro de débito/crédito na tela de Transações** — a Fase 8 adicionou o campo `paymentMethod`, mas ainda não há filtro dedicado por ele (registrado como fora de escopo na spec da época).
- **Reativar conta arquivada** (hoje só existe arquivar e excluir definitivamente — não tem "desarquivar").
- **Lembrete automático de conta desatualizada** (mencionado e descartado como fora de escopo na spec de contas manuais — útil se o usuário parar de importar extrato por um tempo).

## 🔒 Segurança geral para o usuário

Além dos itens já listados em 🔴/🟠 (webhooks sem validação, sem rate limiting, zero testes em código de pagamento):

| Item | Detalhe |
|---|---|
| Confirmar `secure`/`sameSite` dos cookies de sessão em produção | `apps/api/src/lib/auth.ts` não define essas flags explicitamente — o Better Auth costuma inferir a partir do protocolo de `BETTER_AUTH_URL`, mas vale confirmar em produção (HTTPS) em vez de assumir, já que cookie de sessão vazado = conta comprometida. |
| Sem 2FA / verificação em duas etapas | Hoje só email+senha ou Google OAuth. Pra uma conta que movimenta dados financeiros, 2FA (TOTP) é um diferencial de confiança, não só checkbox de segurança. |
| Sem alerta de novo login / dispositivo desconhecido | `Session` guarda `ipAddress`/`userAgent`, mas nada notifica o usuário quando um login acontece de um dispositivo/local novo. |
| Segredos de `PaymentMethodConfig` ficam em texto plano no banco | `config` (JSON) guarda `accessToken`/chave Pix sem criptografia em repouso — só é mascarado na resposta da API (`maskSecrets()`), não no banco. Se o banco for comprometido, os segredos saem em claro. Vale avaliar criptografia de campo (mesma ideia já usada em `OpenFinanceConsent.accessTokenEnc`). |
| Política de senha não verificada | Não foi confirmado se o Better Auth está configurado com requisito mínimo de senha forte (tamanho, complexidade) — checar configuração antes do lançamento. |

## 🕵️ Mascaramento de código pelo DevTools

Importante alinhar expectativa: **qualquer aplicação web entrega JS pro navegador do usuário — não existe forma de impedir 100% a inspeção do código-fonte no DevTools.** O que é possível e vale fazer:

| Item | Detalhe |
|---|---|
| `console.log` de debug esquecidos em produção | `apps/web/components/accounts/connect-bank-button.tsx` tem 5 `console.log` de depuração do fluxo Pluggy (`"[pluggy] connectToken obtido"`, etc.) que vazam detalhes do fluxo interno pra qualquer um que abra o console. Remover antes do release. |
| Confirmar que source maps de produção estão desligados | Next.js já desliga `productionBrowserSourceMaps` por padrão, mas vale confirmar explicitamente no `next.config.ts` — com source map público, o código-fonte original (não minificado) fica disponível no DevTools. |
| Nenhuma chave/segredo vaza no bundle do cliente, hoje | Conferido: variáveis sensíveis (`GROQ_API_KEY`, `MERCADOPAGO_ACCESS_TOKEN`, etc.) só existem no `.env` da API, nunca como `NEXT_PUBLIC_*`. Manter essa disciplina ao adicionar novas integrações — qualquer `NEXT_PUBLIC_*` é visível no bundle e no DevTools por definição. |
| Minificação/ofuscação do build | O build de produção do Next.js já minifica (SWC); ofuscação adicional (nomes de variável embaralhados além da minificação padrão) tem retorno baixo pro esforço — não é uma prioridade real depois de remover os logs e confirmar os dois pontos acima. |

## ⚡ Velocidade e renderização

| Item | Onde | Detalhe |
|---|---|---|
| Bibliotecas pesadas carregadas de forma síncrona | `recharts` (gráficos da Visão Geral), `react-day-picker` (filtro de período) | Nenhum componente do app usa `next/dynamic` hoje — confirmado por busca no projeto. Essas libs entram no bundle inicial de qualquer página que as usa, mesmo antes de qualquer interação. Carregar via `next/dynamic({ ssr: false })` reduziria o JS inicial da Visão Geral e da tela de Transações. |
| Sem `loading.tsx`/Suspense por rota | Todo carregamento hoje depende de estado `isLoading` por componente — uma navegação entre páginas do dashboard não tem feedback instantâneo de transição (skeleton de rota), só o spinner interno depois que o componente já montou. |
| `<img>` nativa em vez de `next/image` | `apps/web/components/ui/category-icon.tsx` | Ícones de categoria customizados (upload do usuário) não passam pela otimização/lazy-loading automático do Next. Baixo impacto hoje (ícones pequenos), mas vale revisitar se crescer. |
| Lista de transações sem virtualização | `apps/web/components/transactions/transaction-list.tsx` | A paginação já limita a 20-100 itens por página (`TransactionFiltersSchema`), então não é crítico agora — mas se a paginação for removida ou o limite aumentado no futuro, listas longas sem virtualização (`@tanstack/virtual` ou similar) pesam no DOM. |

## Como usar este documento

Antes de iniciar qualquer item da seção 🟢, ou qualquer mudança de comportamento nos itens 🔴/🟠, seguir o fluxo já estabelecido neste projeto: brainstorming → spec em `docs/superpowers/specs/` → plano → implementação.
