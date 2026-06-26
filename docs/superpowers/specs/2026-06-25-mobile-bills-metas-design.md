# Design: App mobile — Contas a Pagar (Bills) & Metas

## Contexto

Terceiro sub-projeto do app mobile (`apps/mobile`, Expo Router + NativeWind), parte da
"paridade ampliada". Antecedentes:

- Fundação (auth, navegação, API client) — concluída.
- Telas reais (Visão Geral, Transações, Contas) — concluída.
- Sistema de tema (claro/escuro/sistema com seletor na aba "Mais") — concluído.

Esta fase entrega **duas** das quatro telas de paridade ampliada: **Contas a Pagar**
(Bills) e **Metas** (Goals). Orçamentos e Grupos ficam para uma fase posterior.

Nível de operação acordado: **leitura + criação + ação-chave**. Sem editar/deletar
(consistente com as 3 telas atuais), com uma exceção: a ação-chave de Metas
("adicionar ao poupado") usa o `PATCH` para incrementar o valor poupado.

## Endpoints (já existentes na API)

- `GET /api/bills` → lista de `RecurringBill` (inclui `category {id,name,icon}`), ordenado por `isActive desc, nextDueDate asc`.
- `POST /api/bills` → cria. Campos: `name`, `expectedAmount?`, `frequency` (monthly|weekly|annual|custom), `dayOfMonth?`, `nextDueDate?` (YYYY-MM-DD), `merchantPattern?`, `categoryId?`, `accountId?`.
- `GET /api/goals` → lista de `Goal` (pessoais + de grupos do usuário).
- `POST /api/goals` → cria. Campos: `name`, `description?`, `targetAmount`, `currentAmount?`, `targetDate?`, `icon?`, `color?`, `linkedAccountId?`, `groupId?`.
- `PATCH /api/goals/:id` → atualiza (usado para somar ao `currentAmount`).
- `GET /api/groups` → para o seletor de grupo no form de meta.

## Mudanças

### 1. Tipos compartilhados
Adicionar `RecurringBill` e `Goal` a `apps/mobile/lib/types.ts`, espelhando
`apps/web/lib/types.ts` (apenas campos usados aqui).

### 2. Componente novo — `apps/mobile/components/progress-bar.tsx`
Barra de progresso simples: track (View de fundo) + fill (View colorida com largura
percentual). Props: `value` (0–1), `color?`. Usada nos cards de Metas.

### 3. Navegação — aba "Mais" vira menu
`app/(tabs)/more.tsx`: acima da seção "Tema", adicionar dois itens de menu
("Contas a Pagar", "Metas") que fazem `router.push("/bills")` / `router.push("/goals")`.
Registrar no Stack raiz (`app/_layout.tsx`), com header nativo tematizado (mesmas
cores dos modais, presentation padrão = push):
- `bills` (título "Contas a Pagar")
- `goals` (título "Metas")
- `new-bill` (modal, "Nova Conta")
- `new-goal` (modal, "Nova Meta")
- `add-savings` (modal, "Adicionar ao poupado")

### 4. Tela Contas a Pagar — `app/bills.tsx`
- `FlatList` de cards: `IconBadge` (categoria `icon` ou 📄), nome, linha secundária
  (frequência + "Todo dia N" + "Próximo: data"), valor esperado formatado ou "Valor variável".
- **Badge de vencimento** calculado no cliente a partir de `nextDueDate`:
  - dias < 0 → "Vencida" (destructive)
  - dias ≤ 3 → "Vence em Nd" (warning)
  - dias ≤ 7 → "Em N dias" (neutro)
  - caso contrário → sem badge
- Badge "Inativa" quando `isActive === false`.
- Botão "+ Nova Conta" → `router.push("/new-bill")`. Estado vazio amigável.
- `useFocusEffect` recarrega ao voltar.

### 5. Modal `app/new-bill.tsx`
Campos: nome, valor esperado (opcional, texto numérico), seletor de frequência
(botões), dia do mês (TextInput numérico, só quando frequência = monthly), próximo
vencimento (TextInput texto AAAA-MM-DD). `POST /api/bills` e `router.back()`.

### 6. Tela Metas — `app/goals.tsx`
- `FlatList` de cards: `IconBadge` (cor/ícone), nome, descrição, `ProgressBar`,
  linha "X poupados / meta: Y" (formatados em BRL), badge de dias restantes
  (mesma regra do web: vencido / hoje / N dias restantes), "✅ concluída" se `isCompleted`.
- **Ação-chave:** botão "+ Poupar" no card → `router.push("/add-savings?goalId=...&current=...")`.
- Botão "+ Nova Meta" → `router.push("/new-goal")`. Estado vazio.
- `useFocusEffect` recarrega ao voltar.

### 7. Modais `app/new-goal.tsx` e `app/add-savings.tsx`
- **new-goal:** nome, descrição (opcional), valor alvo, valor atual (opcional), prazo
  (texto AAAA-MM-DD), seletor de grupo (se houver grupos). `POST /api/goals`.
- **add-savings:** lê `goalId` e `current` de `useLocalSearchParams`; campo de valor a
  adicionar; faz `PATCH /api/goals/:id` com `currentAmount = current + valor`. `router.back()`.

### 8. Formatação
Reusar/criar um helper de moeda BRL no mobile (se ainda não existir em `lib/`).
Datas exibidas em formato curto pt-BR.

## Fora de escopo
- Editar/deletar bills e metas (só criação + ação-chave).
- Vínculo de categoria/conta no form de bill; `merchantPattern`.
- Ícone/cor customizados no form de meta (usa default; cor vinda da API é respeitada na exibição).
- Integração na Visão Geral.
- Orçamentos e Grupos (fase posterior).

## Verificação
- `pnpm --filter @finances/mobile typecheck` sem erros.
- Aba "Mais" lista "Contas a Pagar" e "Metas"; ambos abrem as telas.
- Bills: listar com badges de vencimento corretos; criar nova conta pelo modal atualiza a lista ao voltar.
- Metas: listar com barra de progresso e dias restantes; criar nova meta; "Poupar" soma ao valor poupado e reflete na barra ao voltar.
- Estados vazios (sem bills/metas) sem quebrar.
