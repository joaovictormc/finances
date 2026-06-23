# Diferenciação de débito/crédito numa única conta

## Contexto

Hoje cada `FinancialAccount` representa um único tipo (conta corrente OU cartão de crédito), e o import de extrato (introduzido na spec anterior, `2026-06-22-contas-manuais-sem-pluggy-design.md`) é por conta, sem distinção de origem. Bancos brasileiros costumam exportar o extrato da conta corrente e a fatura do cartão de crédito em arquivos separados, mesmo quando ambos pertencem à mesma relação bancária (ex: "Nubank"). O usuário quer cadastrar isso como uma única conta no app e diferenciar, transação a transação, o que veio do extrato (débito) e o que veio da fatura (crédito) — sem precisar criar duas contas separadas.

## Mudanças

### 1. Schema (`packages/db/prisma/schema.prisma`)
- `FinancialAccount.hasCreditCard Boolean @default(false)`.
- `Transaction.paymentMethod String @default("debit")` (valores: `"debit" | "credit"`).
- Tabela criada via script SQL temporário (padrão já usado no projeto: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`), não `prisma migrate dev`, mantendo o `schema.prisma` e o banco sincronizados manualmente como já é feito neste projeto.

### 2. Cadastro de conta
`AccountForm` (`apps/web/app/(dashboard)/accounts/page.tsx`): novo checkbox **"Tem cartão de crédito vinculado"**, ligado a `hasCreditCard`, enviado no `POST`/`PATCH /api/accounts`.

### 3. Import com dois blocos
`ImportForm` (`apps/web/components/transactions/import-form.tsx`): quando a conta (`fixedAccountId`) tem `hasCreditCard = true`, renderiza dois blocos independentes em vez do único campo de arquivo atual:
- **"Extrato conta corrente"** — upload + botão "Importar", chama `POST /api/transactions/import` com `paymentMethod=debit`.
- **"Fatura cartão de crédito"** — upload + botão "Importar", chama o mesmo endpoint com `paymentMethod=credit`.

Cada bloco tem seu próprio estado de loading/resultado (toast separado). Quando `hasCreditCard = false`, mantém o campo único atual, sempre `paymentMethod=debit` (comportamento inalterado).

Quando o banco exporta tudo num arquivo só, o usuário sobe esse arquivo no bloco "Extrato conta corrente" — tudo entra como débito. O app não tenta inferir crédito x débito dentro de um arquivo combinado; ajuste manual posterior (editar transação) cobre o caso raro de precisar reclassificar uma linha.

**Backend** (`apps/api/src/routes/transactions.ts`, rota `POST /import`): aceita `paymentMethod` no form-data (`"debit" | "credit"`, default `"debit"` se ausente/inválido) e grava em cada linha de `db.transaction.createMany`.

### 4. Transação manual e exibição
- `TransactionForm` (`apps/web/components/transactions/transaction-form.tsx`): quando a conta selecionada (`accountId`) tem `hasCreditCard = true`, mostra um seletor "Forma de pagamento" (Débito/Crédito, default Débito). Quando a conta não tem cartão vinculado, o campo não aparece e `paymentMethod` é sempre `"debit"`.
- `TransactionList` e `RecentTransactions`: badge "💳 Crédito" (reaproveitando `components/ui/badge.tsx`, mesmo padrão do badge de grupo) ao lado da descrição quando `t.paymentMethod === "credit"`. Débito não exibe nada (é o padrão implícito).
- `apps/web/lib/types.ts`: `Transaction.paymentMethod` e `FinancialAccount.hasCreditCard` adicionados aos tipos.

## Fora de escopo
- Inferir automaticamente débito/crédito dentro de um arquivo combinado.
- Filtro dedicado de débito/crédito na tela de Transações (fica para uma fase futura, se necessário).
- Qualquer mudança em `FinancialAccount.type` (continua existindo "credit_card" como tipo de conta separado, para quem prefere modelar assim — este recurso é independente disso).

## Verificação
- `pnpm --filter @finances/web typecheck` e `pnpm --filter @finances/api typecheck` sem erros.
- Criar conta com "Tem cartão de crédito vinculado" marcado → Drawer de import mostra os dois blocos. Sem marcar → mantém o campo único de hoje.
- Importar um CSV/OFX no bloco "Extrato conta corrente" → transações criadas com `paymentMethod: "debit"`, sem badge na lista.
- Importar outro arquivo no bloco "Fatura cartão de crédito" → transações criadas com `paymentMethod: "credit"`, badge "💳 Crédito" aparece na lista e nas transações recentes da Visão Geral.
- Criar transação manual numa conta com cartão vinculado → seletor de forma de pagamento aparece e é respeitado. Numa conta sem cartão vinculado → seletor não aparece, transação sai como débito.
