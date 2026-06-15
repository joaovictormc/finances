# UI Components Design — Dashboard Financeiro

**Data:** 2026-06-15  
**Escopo:** Sistema de componentes base para as telas de transações, orçamentos e overview  
**Stack:** Next.js 16 App Router · Tailwind v4 · TypeScript · API Hono já implementada

---

## Decisões de Design

| # | Decisão | Escolha |
|---|---|---|
| 1 | Padrão de formulário | **Drawer Lateral (B)** — painel desliza pela direita |
| 2 | Input de valor monetário | **Máscara BR (B)** — type="text" + inputmode="numeric", estilo caixa registradora |
| 3 | Filtro de categorias por tipo | **Pre-load + filtro client-side** — sem re-fetch ao mudar tipo |
| 4 | Layout da lista de transações | **Tabela no desktop, cards no mobile (A)** |
| 5 | Feedback ao usuário | **Toast flutuante (A)** — canto inferior direito, auto-dismiss 4s |

---

## Arquitetura de Componentes

### `apps/web/components/ui/` — Primitivos base

Todos usam tokens Tailwind v4 do `globals.css` (`--color-card`, `--color-border`, `--color-primary`, etc.) e o utilitário `cn()` de `lib/utils.ts`.

**`button.tsx`**
- Variantes: `default` (bg-primary), `outline`, `ghost`, `destructive`  
- Tamanhos: `sm`, `md` (padrão), `lg`  
- Prop `loading`: substitui ícone por spinner inline, desabilita click  

**`input.tsx`**
- Props: `label?`, `error?`, mais todos os attrs nativos de `<input>`  
- Estilo: `border border-[--color-border] bg-[--color-card] rounded-md px-3 py-2`  
- Estado de erro: borda `--color-destructive` + texto de erro abaixo  

**`select.tsx`**
- Wrapper de `<select>` nativo com mesmo estilo do Input  
- Props: `options: { value: string; label: string }[]`, `label?`, `error?`  

**`currency-input.tsx`**
- `type="text" inputmode="numeric"` — abre teclado numérico no mobile  
- Prefixo `R$` absolutamente posicionado à esquerda  
- Máscara em tempo real: digita centavos da direita → `123456` → exibe `1.234,56`  
- Função `parseBRL(value: string): number` para converter na submissão  
- Função `formatBRL(cents: number): string` para exibição  

**`badge.tsx`**
- Pill colorida por tipo: `income` → success, `expense` → destructive, `transfer` → blue  
- Também usado para categorias com ícone opcional  

**`spinner.tsx`**
- `animate-spin` border-based, tamanhos `sm`/`md`/`lg`  

**`drawer.tsx`**  
- Overlay fixo `fixed inset-0 bg-black/50 z-40` (fecha ao clicar)  
- Painel `fixed right-0 top-0 bottom-0 w-[420px] max-w-full bg-[--color-card]`  
- Animação via `translate-x-full` → `translate-x-0` com `transition-transform duration-200`  
- Header com título + botão ✕  
- Fecha no Escape (`useEffect` + `keydown`)  
- Props: `open`, `onClose`, `title`, `children`  

**`toast.tsx`** + **`toast-provider.tsx`**
- Provider envolve o layout em `app/(dashboard)/layout.tsx`  
- Context expõe `toast({ title, description?, variant: 'success'|'error'|'warning' })`  
- Renderiza stack de toasts no canto `fixed bottom-4 right-4 z-50`  
- Auto-dismiss: `setTimeout` de 4000ms  
- Animação: `translate-y-2 opacity-0` → `translate-y-0 opacity-100`  
- Barra de progresso animada na base do toast  

**`empty-state.tsx`**
- Props: `icon` (lucide), `title`, `description`, `action?: { label, onClick }`  

---

### `apps/web/lib/types.ts` — Tipos das respostas da API

```typescript
export type Transaction = {
  id: string
  type: 'income' | 'expense' | 'transfer'
  amount: string          // Decimal → string no JSON; usar Number() antes de exibir
  description: string
  date: string
  notes: string | null
  isIgnored: boolean
  source: string
  category: { id: string; name: string; icon: string | null; color: string | null } | null
  account: { id: string; name: string; institution: string | null; color: string | null }
  createdAt: string
}

export type PaginatedResponse<T> = {
  data: T[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export type Category = {
  id: string; name: string; icon: string | null; color: string | null
  type: string; children: Category[]
}

export type FinancialAccount = {
  id: string; type: string; name: string
  institution: string | null; color: string | null
}

export type Budget = {
  id: string; name: string; amount: string; period: string; alertThreshold: string
  category: { id: string; name: string; icon: string | null } | null
  spentAmount: number; percentage: number; isOverBudget: boolean; isNearLimit: boolean
}
```

---

### `apps/web/components/transactions/`

**`transaction-filters.tsx`** (client component)
- Controles: campo de busca (debounce 300ms), select de tipo, date pickers de início/fim  
- Emite `onFilterChange(filters)` ao pai  

**`transaction-list.tsx`** (client component)
- Desktop (`md+`): `<table>` com colunas Data / Descrição / Categoria / Conta / Valor / Ações  
- Mobile (`< md`): stack de cards com ícone da categoria, descrição, valor  
- Ações por linha: ícone de editar (abre drawer preenchido) e deletar (`window.confirm()` no MVP — substituir por modal próprio na Fase 2)  
- `amount` vem como string → `formatBRL(Number(transaction.amount))`  
- Loading state: skeleton rows (divs animados com `animate-pulse`)  

**`transaction-form.tsx`** (client component, dentro do Drawer)
- Tabs no topo: Gasto / Receita / Transferência  
- Campos: CurrencyInput (valor), Input (descrição), Select (conta), Select (categoria, filtrado por tipo client-side), Input type="date" (data, default hoje)  
- Ao mudar tipo: filtra lista de categorias carregada ao abrir o drawer  
- Submit: `api.post('/api/transactions', payload)` ou `api.patch(...)` se editando  
- Após sucesso: `toast({ title: 'Transação criada!', variant: 'success' })` + fecha drawer + refetch  

**`app/(dashboard)/transactions/page.tsx`** (client component `"use client"`)
- Estado: `transactions`, `meta`, `isLoading`, `filters`, `drawerOpen`, `editingTransaction`  
- Monta: `TransactionFilters` + botão "+ Nova Transação" + `TransactionList` + `Drawer > TransactionForm`  
- Após qualquer CRUD: refetch via função `loadTransactions(filters)`  

---

### `apps/web/components/budgets/`

**`budget-progress-bar.tsx`**
- Width via style inline: `width: ${Math.min(pct * 100, 100)}%`  
- Cor: normal → `--color-success` | near limit → `--color-warning` | over → `--color-destructive`  

**`budget-form.tsx`** (dentro do Drawer)
- Campos: nome, CurrencyInput (limite), Select (categoria, opcional), Select (período), Input (alertThreshold como slider 0-100%)  

**`app/(dashboard)/budgets/page.tsx`**
- Busca `GET /api/budgets?year=&month=` (mês atual por padrão)  
- Grid de cards: cada card com BudgetProgressBar + valores + ações  

---

## Gotchas de Implementação

| Área | Problema | Solução |
|---|---|---|
| Tailwind v4 | Sem `tailwind.config.js` | Tudo em `globals.css` via `@theme inline` |
| Tailwind v4 | Sem `bg-opacity-*` | Usar slash: `bg-black/50` |
| Next.js 16 | `params` é assíncrono | `const { id } = await params` em rotas `[id]` |
| Prisma Decimal | `amount` vira string no JSON | `Number(transaction.amount)` antes de exibir |
| Drawer | Foco ao abrir | `autoFocus` no primeiro campo do form |
| Toast | Múltiplos toasts | Array de toasts no context, cada um com id único |
| Currency mask | Deletar no meio | Tratar apenas `keydown` em numerais, ignorar posição do cursor |
| `"use client"` | Componentes com hooks | Verificar que todo componente com `useState`/`useEffect` tem a diretiva |

---

## Ordem de Build

1. `components/ui/` — spinner, button, input, select, badge, empty-state
2. `components/ui/currency-input.tsx` — máscara BR
3. `components/ui/drawer.tsx` — animação + overlay
4. `components/ui/toast.tsx` + `toast-provider.tsx` — context + render
5. `lib/types.ts` — tipos da API
6. `components/transactions/transaction-filters.tsx`
7. `components/transactions/transaction-form.tsx`
8. `components/transactions/transaction-list.tsx`
9. `app/(dashboard)/transactions/page.tsx` — wiring completo
10. `components/budgets/` + `app/(dashboard)/budgets/page.tsx`
11. Charts no overview (`spending-chart.tsx`, `monthly-bar-chart.tsx`)
