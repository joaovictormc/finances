# App mobile — Telas reais (Visão Geral, Transações, Contas)

## Contexto

Segundo sub-projeto do mobile, seguindo a decomposição: Fundação (concluída — auth, navegação, cliente de API, abas placeholder) → **este** (MVP de telas reais) → paridade ampliada (Orçamentos/Metas/Bills/Grupos, débito/crédito, import) → recursos avançados (push, biometria, offline). As 3 abas hoje só têm `<Text>Em breve</Text>`.

## Mudanças

### 1. Tipos compartilhados
Novo `apps/mobile/lib/types.ts`, espelhando `apps/web/lib/types.ts` — só os campos usados neste MVP (`Transaction`, `FinancialAccount`, `Category`, `PaginatedResponse`), sem `paymentMethod`/`hasCreditCard` (Fase 8, fora de escopo aqui).

### 2. Visão Geral — `app/(tabs)/index.tsx`
- KPIs de Receitas/Gastos do mês via `GET /api/transactions/reports/monthly`.
- Gráfico de pizza por categoria usando `react-native-gifted-charts` (`PieChart`), alimentado por `byCategory` do mesmo endpoint.
- Lista das 5 transações mais recentes via `GET /api/transactions?limit=5` (somente leitura, sem ações).

### 3. Transações — `app/(tabs)/transactions.tsx`
- `FlatList` com scroll infinito (`onEndReached` carrega a próxima página de `GET /api/transactions?page=&limit=`), busca por texto com debounce (mesmo padrão de `apps/web/components/transactions/transaction-filters.tsx`) e filtro de tipo (receita/gasto/transferência) num seletor simples no topo.
- Item da lista: ícone de categoria, descrição, categoria, data, valor colorido por tipo. Sem editar/deletar nesta fase.
- Botão "+" no header abre `app/new-transaction.tsx` (rota modal, fora do grupo `(tabs)`): tipo, valor, descrição, conta, categoria, data, observações — `POST /api/transactions`. Sem seletor de débito/crédito.

### 4. Contas — `app/(tabs)/accounts.tsx`
- Lista de cards: ícone por tipo (mesmo mapeamento do web), nome, tipo, instituição. Sem indicador de defasagem (`lastSyncedAt`) nesta fase.
- Botão "+ Nova Conta" abre `app/new-account.tsx` (modal): nome, tipo, instituição, grupo — `POST /api/accounts`. Sem toggle de cartão vinculado (Fase 8).

### 5. Modais de criação
`apps/mobile/app/_layout.tsx`: adicionar `new-transaction` e `new-account` como `<Stack.Screen>` com `options={{ presentation: "modal", headerShown: true }}` no Stack raiz (fora do grupo `(tabs)`), navegados via `router.push("/new-transaction")`/`router.push("/new-account")`. Header nativo do modal traz "Cancelar" (esquerda) e "Salvar" (direita, ou um botão de submit no fim do formulário).

### 6. Dependência nova
`react-native-gifted-charts` (+ `react-native-svg`, sua peer dependency) — adicionar como dependência direta do `apps/mobile` (padrão já estabelecido neste projeto: nunca depender de transitivas).

## Fora de escopo
Editar/deletar transações ou contas; débito/crédito e contas com cartão vinculado (Fase 8); import de extrato; indicador de defasagem de sincronização; filtros de período/conta na lista de Transações; Orçamentos/Metas/Bills/Grupos (próximo sub-projeto).

## Verificação
- `pnpm --filter @finances/mobile typecheck` sem erros.
- Visão Geral mostra KPIs reais, gráfico de pizza e as transações recentes de uma conta de teste.
- Lista de Transações: busca filtra corretamente, filtro de tipo funciona, scroll infinito carrega mais páginas, "+" abre o modal e criar uma transação nova atualiza a lista ao voltar.
- Lista de Contas: mostra as contas existentes; "+ Nova Conta" cria e atualiza a lista.
- Em conta vazia (sem transações/contas), cada tela mostra um estado vazio razoável (não quebra/não fica em branco).
