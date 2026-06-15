# Financeiro — Documentação do Projeto

SaaS de finanças pessoais para o mercado brasileiro com diferenciais: integração bancária via Open Finance Brasil (OAuth, sem pedir senha), registro de gastos por chat/voz no Telegram e WhatsApp, alertas preditivos com IA.

## Documentação

| Arquivo | Conteúdo |
|---|---|
| [architecture.md](./architecture.md) | Stack, estrutura do monorepo, fluxo de dados |
| [setup.md](./setup.md) | Setup local, ZimaOS (PostgreSQL + Redis), Expo Go |
| [api.md](./api.md) | Todos os endpoints da API Hono |
| [features.md](./features.md) | Funcionalidades por fase (feito / em progresso / planejado) |
| [integrations.md](./integrations.md) | Telegram, WhatsApp, Open Finance Brasil, Pluggy, Claude API, Brevo |
| [database.md](./database.md) | Schema Prisma, tabelas, TimescaleDB, seed |

## Status Atual

**Fase 0 concluída** — Infraestrutura completa (commit 5a5e5a2).

**Em andamento — Fase 1:** UI web de transações, orçamentos e relatórios.

## Diferenciais vs Concorrentes

| Concorrente | Fraqueza | Nosso diferencial |
|---|---|---|
| Organizze | Sem banco, sem IA, sem chat | Open Finance + NLP via WhatsApp/Telegram |
| Mobills | Banco pago, sem NLP | Open Finance gratuito + conversacional |
| GuiaBolso | Estagnado, pede senha bancária | Ativo + OAuth seguro |
| Minhas Economias | UI datada, sem chat | UX moderno + voz no WhatsApp |
