# Funcionalidades por Fase

Legenda: ✅ Feito | 🔄 Em progresso | 📋 Planejado

## Fase 0 — Infraestrutura ✅

| Funcionalidade | Status | Detalhes |
|---|---|---|
| Monorepo Turborepo + pnpm | ✅ | `turbo.json`, `pnpm-workspace.yaml` |
| Docker Compose local | ✅ | PostgreSQL+TimescaleDB, Redis, Mailpit |
| Prisma Schema completo | ✅ | 26 models, `packages/db/prisma/schema.prisma` |
| Seed categorias BR | ✅ | Alimentação, Transporte, Moradia, Saúde, Lazer... |
| Hono API skeleton | ✅ | Port 3001, CORS, logger, health check |
| Better Auth | ✅ | Email+senha, Google OAuth, sessão Redis, roles (user/support/admin) |
| BullMQ queues | ✅ | email, bot-messages, voz, sync, ai-analysis, bill-detector |
| Telegram Bot (grammy) | ✅ | /start, /ajuda, /resumo, mensagens, voz |
| Parsing NLP (Groq) | ✅ | Llama 3.3 70B, tool calling, PT-BR |
| React Email templates | ✅ | Verificação, boas-vindas, alerta orçamento, lembrete de conta |
| GitHub Actions CI | ✅ | typecheck, lint, build |

## Fase 1 — MVP Finanças Manual ✅

| Funcionalidade | Status | Detalhes |
|---|---|---|
| API: CRUD transações | ✅ | GET/POST/PATCH/DELETE + filtros + paginação |
| API: Relatório mensal | ✅ | `GET /api/transactions/reports/monthly` |
| API: CRUD orçamentos | ✅ | Com cálculo de % gasto e alertas |
| API: CRUD categorias | ✅ | Hierárquico, sistema + usuário |
| API: CRUD contas financeiras | ✅ | Checking, savings, credit_card, investment, wallet |
| API: CRUD metas financeiras | ✅ | `GET/POST/PATCH/DELETE /api/goals` |
| API: CRUD contas recorrentes | ✅ | `GET/POST/PATCH/DELETE /api/bills` |
| Web: Identidade visual indigo | ✅ | Paleta OKLCH diferenciada, dark mode preto puro |
| Web: Toggle tema claro/escuro | ✅ | localStorage + inline script (sem FOUC) |
| Web: Overview com charts | ✅ | KPIs + PieChart categorias + BarChart 6 meses + insights de IA |
| Web: CRUD transações completo | ✅ | Drawer lateral + máscara BR + tabela+cards |
| Web: Filtros de transações | ✅ | Busca debounce, tipo, grupo, período (calendário — Fase 8) |
| Web: Página de orçamentos | ✅ | Explicação onboarding + progress bars |
| Web: Página de contas bancárias | ✅ | Cards por tipo + faixa de status de sincronização (Fase 8) |
| Web: Página de metas | ✅ | Progress bars + dias restantes |
| Web: Página de contas a pagar | ✅ | Badges urgência vencimento |
| Web: Página de configurações | ✅ | Toggle tema + perfil + notificações + assinatura |
| Web: Autenticação (login/registro) | ✅ | Login, registro, verificação de e-mail (Better Auth) |
| Mobile: Telas básicas | 📋 | Só scaffold (`(tabs)/index.tsx`), sem telas reais |
| Email: Boas-vindas + verificação | ✅ | Entregue por email worker (BullMQ → Brevo) |

## Fase 2 — Bot + NLP ✅

| Funcionalidade | Status | Detalhes |
|---|---|---|
| Telegram: Fluxo de vinculação | ✅ | `/start` gera código (Redis, 10min) → `/bot` resgata via `POST /api/bots/telegram/link` |
| Telegram: Registro por texto | ✅ | Groq (Llama 3.3) + confirmação via inline keyboard |
| Telegram: Registro por voz | ✅ | Whisper (Groq) → parsing → confirmação |
| Telegram: /resumo mensal | ✅ | Consulta DB e responde em PT-BR |
| WhatsApp: Webhook handler | 📋 | Meta Cloud API — não iniciado |
| WhatsApp: Registro gastos | 📋 | Mesma pipeline NLP do Telegram — não iniciado |

## Fase 3 — Integração Bancária ✅ (parcial)

| Funcionalidade | Status | Detalhes |
|---|---|---|
| Pluggy: Connect token + widget | ✅ | `POST /api/pluggy/connect-token`, `pluggy-connect-sdk` no web — atrás de `NEXT_PUBLIC_ENABLE_PLUGGY` (Fase 8, custo mensal) |
| Pluggy: Criação de contas/sync | ✅ | `POST /api/pluggy/items` + `open-finance-sync` worker (BullMQ) |
| Pluggy: Webhook | ✅ | `POST /api/webhooks/pluggy` (sem HMAC — revalida dados via API autenticada) |
| Auto-categorização | 📋 | Não implementado |
| Open Finance Brasil (RAIDIAM) | 📋 | Schema pronto (`OpenFinanceConsent`, `OpenFinanceAccount`), sem integração real |

## Fase 4 — IA e Alertas ✅

| Funcionalidade | Status | Detalhes |
|---|---|---|
| Insight mensal (Groq) | ✅ | `lib/ai/financial-insights.ts`, worker `ai-analysis` |
| Detecção de recorrências | ✅ | `lib/ai/recurring-detector.ts` |
| Alertas preditivos / forecast | ✅ | `lib/ai/budget-forecast.ts` |
| NL queries no bot/web | ✅ | `POST /api/ai/query` — tool calling (Groq), caixa de pergunta na Visão Geral |
| Configuração de modelo/limites (admin) | ✅ | `AiSettings`, `AiUsageLog`, página `/admin/ai` |

## Fase 5 — Família/Grupo ✅

| Funcionalidade | Status | Detalhes |
|---|---|---|
| Criar grupo financeiro | ✅ | `POST /api/groups`, limitado ao plano Família |
| Convite por link | ✅ | `GET /api/groups/:id/invite-link`, `/groups/join/[code]` |
| Contas/transações compartilhadas | ✅ | `groupId` em `FinancialAccount`/`Transaction`/`Budget`/`Goal` |
| Gestão de membros/roles | ✅ | owner/admin/member/viewer |
| Dashboard agregado do grupo | ✅ | `GET /api/groups/:id/dashboard` |
| Notificações de atividade do grupo | ✅ | `notifyGroupMembers()` |

## Fase 6 — Monetização ✅

| Funcionalidade | Status | Detalhes |
|---|---|---|
| Assinaturas via Mercado Pago | ✅ | Planos Free/Pro/Família, checkout + webhook + cancelamento |
| Pix direto (pagamento alternativo) | ✅ | QR code estático (BR Code) + confirmação manual pelo admin |
| PWA (add to home screen) | ✅ | `manifest.json` + `sw.js` em `apps/web/public` |
| Import CSV/OFX | ✅ | `POST /api/transactions/import`, dedup por `externalId` |
| Relatório anual em PDF | ✅ | `GET /api/reports/annual`, `@react-pdf/renderer` |
| Sistema de referral | ✅ | Código próprio, 30 dias grátis ao indicado assinar |

## Fase 7 — Área Administrativa ✅

| Funcionalidade | Status | Detalhes |
|---|---|---|
| Roles de usuário | ✅ | `user` / `support` / `admin`, contas admin com acesso total (`ADMIN_PLAN`) |
| Gestão de usuários/planos | ✅ | `/admin/users` — alterar plano/role, cancelar assinatura manualmente |
| Histórico de checkouts | ✅ | `/admin/checkouts` — eventos do Mercado Pago + Pix, filtro por tipo |
| Confirmação manual de Pix | ✅ | Botão "Confirmar pagamento" ativa o plano do usuário |
| Configuração de métodos de pagamento | ✅ | `/admin/payment-methods` — grid Mercado Pago/Pix, segredos mascarados, auto-ativação ao completar campos |
| Configuração de IA | ✅ | `/admin/ai` — modelo de texto/voz, kill-switches por feature, limite mensal de tokens, painel de uso |

## Fase 8 — Refinamentos de contas e transações 🔄

Trabalho em andamento nesta sessão, ainda não commitado.

| Funcionalidade | Status | Detalhes |
|---|---|---|
| Pluggy por feature flag | ✅ | `NEXT_PUBLIC_ENABLE_PLUGGY` — esconde o botão "Conectar Banco" sem remover o código (custo mensal alto) |
| Fluxo de contas manuais | ✅ | Import de extrato (CSV/OFX) movido para o card de cada conta, com indicador de defasagem (`lastSyncedAt`) |
| Contas arquivadas + exclusão definitiva | ✅ | Aba "Arquivadas" + `DELETE /api/accounts/:id/permanent` (cascata de transações) |
| Diferenciação débito/crédito numa conta | ✅ | `FinancialAccount.hasCreditCard` + `Transaction.paymentMethod`, dois blocos de import (extrato/fatura), badge "💳 Crédito" |
| Filtro de período com calendário | ✅ | `react-day-picker`, atalhos (Hoje/7 dias/mês/mês passado) + seleção manual de intervalo |
| Colunas ajustáveis na grid de transações | 🔄 | Largura fixada por coluna (`width`/`minWidth`/`maxWidth`) + persistência em `localStorage` — **bug conhecido em aberto**: arrastar ainda não redimensiona de forma confiável quando há descrições muito longas na lista |

## Sem fase definida — backlog conhecido

- WhatsApp Business API (Fase 2, nunca iniciada).
- Open Finance Brasil real via RAIDIAM (Fase 3, schema pronto).
- Auto-categorização de transações importadas/sincronizadas.
- Telas reais do app mobile (Expo) — hoje é só scaffold.
- Resolver o bug de redimensionamento de colunas da Fase 8.
