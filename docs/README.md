# ControlAI — Documentação do Projeto

SaaS de finanças pessoais para o mercado brasileiro com diferenciais: integração bancária via Pluggy (Open Finance), registro de gastos por chat/voz no Telegram, insights e alertas com IA (Groq), assinaturas via Mercado Pago/Pix, compartilhamento familiar e área administrativa completa.

## Documentação

| Arquivo | Conteúdo |
|---|---|
| [architecture.md](./architecture.md) | Stack, estrutura do monorepo, fluxo de dados |
| [setup.md](./setup.md) | Setup local, ZimaOS (PostgreSQL + Redis), variáveis de ambiente |
| [api.md](./api.md) | Todos os endpoints da API Hono |
| [features.md](./features.md) | Funcionalidades por fase (feito / em progresso / planejado) |
| [integrations.md](./integrations.md) | Telegram, Pluggy, Groq, Mercado Pago/Pix, Brevo, WhatsApp e Open Finance Brasil (planejados) |
| [database.md](./database.md) | Schema Prisma, tabelas, TimescaleDB, seed |
| [next-version.md](./next-version.md) | Bugs conhecidos, lacunas estruturais e candidatos a funcionalidade pra próxima versão |

## Status Atual

**Fases 0 a 7 concluídas** — infraestrutura, MVP de finanças manuais, bot Telegram com NLP (texto e voz), integração bancária via Pluggy, insights de IA, compartilhamento familiar/grupo, monetização (Mercado Pago + Pix) e área administrativa.

**Fase 8 em andamento** — refinamentos do fluxo de contas e transações: Pluggy controlado por feature flag (custo mensal), diferenciação débito/crédito numa única conta, filtro de período com calendário e colunas ajustáveis na grid de transações (ver [features.md](./features.md#fase-8--refinamentos-de-contas-e-transações)).

`apps/mobile` (Expo) continua só com o scaffold inicial — sem telas reais implementadas.

## Diferenciais vs Concorrentes

| Concorrente | Fraqueza | Nosso diferencial |
|---|---|---|
| Organizze | Sem banco, sem IA, sem chat | Pluggy + NLP via Telegram |
| Mobills | Banco pago, sem NLP | Integração bancária + conversacional |
| GuiaBolso | Estagnado, pede senha bancária | Ativo + OAuth seguro (Pluggy) |
| Minhas Economias | UI datada, sem chat | UX moderno + voz no Telegram |
