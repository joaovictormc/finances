# Funcionalidades por Fase

Legenda: ✅ Feito | 🔄 Em progresso | 📋 Planejado

## Fase 0 — Infraestrutura ✅

| Funcionalidade | Status | Detalhes |
|---|---|---|
| Monorepo Turborepo + pnpm | ✅ | `turbo.json`, `pnpm-workspace.yaml` |
| Docker Compose local | ✅ | PostgreSQL+TimescaleDB, Redis, Mailpit |
| Prisma Schema completo | ✅ | 15+ tabelas, `packages/db/prisma/schema.prisma` |
| Seed categorias BR | ✅ | Alimentação, Transporte, Moradia, Saúde, Lazer... |
| Hono API skeleton | ✅ | Port 3001, CORS, logger, health check |
| Better Auth | ✅ | Email+senha, Google OAuth, sessão Redis |
| BullMQ queues | ✅ | email, bot-messages, voice, sync, ai-analysis |
| Telegram Bot (grammy) | ✅ | /start, /ajuda, /resumo, mensagens, voz |
| Claude NLP parser | ✅ | Haiku-4-5, tool_use, PT-BR, confiança 0.7 |
| React Email templates | ✅ | Verificação, boas-vindas, alerta orçamento, boleto |
| GitHub Actions CI | ✅ | typecheck, lint, build |

## Fase 1 — MVP Finanças Manual ✅

| Funcionalidade | Status | Detalhes |
|---|---|---|
| API: CRUD transações | ✅ | GET/POST/PATCH/DELETE + filtros + paginação |
| API: Relatório mensal | ✅ | `GET /api/transactions/reports/monthly` |
| API: CRUD orçamentos | ✅ | Com cálculo de % gasto e alertas |
| API: CRUD categorias | ✅ | Hierárquico, sistema + usuário |
| API: CRUD contas financeiras | ✅ | Checking, savings, credit_card, wallet |
| API: CRUD metas financeiras | ✅ | `GET/POST/PATCH/DELETE /api/goals` |
| API: CRUD contas recorrentes | ✅ | `GET/POST/PATCH/DELETE /api/bills` |
| Web: Identidade visual indigo | ✅ | Paleta OKLCH diferenciada, dark mode preto puro |
| Web: Toggle tema claro/escuro | ✅ | localStorage + inline script (sem FOUC) |
| Web: Overview com charts | ✅ | KPIs + PieChart categorias + BarChart 6 meses |
| Web: Navegação de mês no overview | ✅ | search params `?year=&month=` |
| Web: CRUD transações completo | ✅ | Drawer lateral + máscara BR + tabela+cards |
| Web: Filtros de transações | ✅ | Busca debounce, tipo, date range |
| Web: Página de orçamentos | ✅ | Explicação onboarding + progress bars |
| Web: Página de contas bancárias | ✅ | Cards por tipo + drawer criação |
| Web: Página de metas | ✅ | Progress bars + dias restantes |
| Web: Página de contas a pagar | ✅ | Badges urgência vencimento |
| Web: Página de configurações | ✅ | Toggle tema + perfil + notificações |
| Web: Sidebar com active state | ✅ | Destaca página atual |
| Web: Navegação mobile | ✅ | Header hamburger + drawer slide-out |
| Web: Biblioteca de componentes | ✅ | Button, Input, Select, CurrencyInput, Drawer, Toast, Badge, etc |
| Web: Autenticação (login/registro) | 🔄 | Login page pronto, registro pendente |
| Mobile: Telas básicas | 📋 | Overview, transações, perfil |
| Email: Boas-vindas + verificação | ✅ | Templates prontos, disparo via Brevo |

## Fase 2 — Bot + NLP

| Funcionalidade | Status | Detalhes |
|---|---|---|
| Telegram: Fluxo de vinculação | 📋 | Web gera código → /start valida |
| Telegram: Registro por texto | ✅ | Claude Haiku + confirmação via inline keyboard |
| Telegram: Registro por voz | 📋 | Whisper API → Claude |
| Telegram: /resumo mensal | ✅ | Consulta DB e responde em PT-BR |
| WhatsApp: Webhook handler | 📋 | Meta Cloud API |
| WhatsApp: Registro gastos | 📋 | Mesma pipeline NLP do Telegram |

## Fase 3 — Integração Bancária

| Funcionalidade | Status | Detalhes |
|---|---|---|
| Pluggy: Widget Connect | 📋 | Embedded na web |
| Pluggy: Sync de transações | 📋 | Webhook + dedup por external_id |
| Auto-categorização | 📋 | Claude Haiku em batch por descrição |
| Open Finance Brasil | 📋 | Requer registro RAIDIAM (~4-12 semanas) |

## Fase 4 — IA e Alertas

| Funcionalidade | Status | Detalhes |
|---|---|---|
| Insight mensal (Claude Sonnet) | 📋 | BullMQ, dia 1° de cada mês |
| Detecção de recorrências | 📋 | Agrupa por merchant normalizado |
| Alertas preditivos | 📋 | Projeção de saldo + forecast orçamento |
| NL queries no bot | 📋 | "quanto gastei essa semana?" → Claude tool_use |

## Fase 5 — Família/Grupo

| Funcionalidade | Status | Detalhes |
|---|---|---|
| Criar grupo financeiro | 📋 | Schema pronto (`groups`, `group_members`) |
| Contas compartilhadas | 📋 | |
| Dashboard agregado do grupo | 📋 | |

## Fase 6 — Monetização

| Funcionalidade | Status | Detalhes |
|---|---|---|
| Stripe: Planos Free/Pro/Família | 📋 | Free R$0, Pro R$19,90, Família R$29,90 |
| PWA (add to home screen) | 📋 | |
| Import CSV/OFX | 📋 | |
| Relatório anual em PDF | 📋 | `@react-pdf/renderer` |
