# UX da tela de Transações: filtro de período e colunas ajustáveis

## Contexto

Segunda parte de um pedido decomposto em duas specs (a primeira, diferenciação débito/crédito no import, já foi implementada). O filtro de data hoje usa dois `<DateInput>` (input de texto mascarado DD/MM/AAAA, sem calendário visual) e a coluna Descrição da grid de transações corta o texto com `truncate max-w-[200px]` fixo, sem controle do usuário. O objetivo é trocar o filtro de data por um seletor de período com mini-calendário, e permitir ajustar manualmente a largura das colunas da grid.

## Mudanças

### 1. Filtro de período com mini-calendário
- Nova dependência: `react-day-picker` (~20kb, modo `range` nativo, React 19 compatível), instalada em `apps/web`.
- Em `apps/web/components/transactions/transaction-filters.tsx`, os dois `<DateInput>` (`startDate`/`endDate`) são substituídos por um único botão de período (ex: "📅 01/06/2026 — 30/06/2026", ou "Período" quando vazio) que abre um popover com:
  - Lista de atalhos: **Hoje**, **Últimos 7 dias**, **Este mês**, **Mês passado** — cada um já calcula e aplica `startDate`/`endDate` direto.
  - Calendário `DayPicker` em modo `range` para seleção manual, estilizado com as variáveis de tema já existentes (`--color-primary`, `--color-card`, `--color-border`, etc. via CSS custom properties do `react-day-picker`).
- Nenhuma mudança de schema/backend: `TransactionFiltersSchema` (`packages/validations/src/transaction.schema.ts`) já aceita `startDate`/`endDate` opcionais.
- Componente novo: `apps/web/components/ui/date-range-picker.tsx`, recebendo `{ startDate, endDate, onChange }` e encapsulando popover + atalhos + `DayPicker`. `DateInput` (`apps/web/components/ui/date-input.tsx`) não é removido — continua em uso noutros formulários (ex: `TransactionForm`, que usa data única).

### 2. Colunas ajustáveis na grid de Transações
- Em `apps/web/components/transactions/transaction-list.tsx` (tabela desktop): cada coluna (Data, Descrição, Categoria, Conta, Valor) ganha uma alça de redimensionamento na borda direita do `<th>` — arrastar com o mouse ajusta a largura em tempo real (`onMouseDown` + listener de `mousemove`/`mouseup` no `document`, padrão comum de resize de coluna).
- Larguras guardadas em estado (`Record<columnKey, number>`) e persistidas em `localStorage` (chave `transactions-column-widths`), recarregadas no mount — a largura escolhida pelo usuário continua nas próximas visitas.
- A coluna Descrição deixa de ter `max-w-[200px]` fixo no JSX; a largura passa a vir do estado (aplicada via `style={{ width }}` no `<th>`/`<td>`), com um mínimo de 80px por coluna para não colapsar. `truncate` continua ativo (o texto ainda corta dentro da largura escolhida, mas agora o usuário controla até onde) — sem quebra de linha.
- Tabela mobile (cards) não é afetada — esse ajuste é só para a visão desktop em tabela.

## Fora de escopo
Persistir larguras de coluna por usuário no backend (fica só em `localStorage` do navegador); tooltip de texto completo ao passar o mouse (resolvido via redimensionamento manual); mudanças no `DateInput` usado em outros formulários.

## Verificação
- `pnpm --filter @finances/web typecheck` sem erros.
- Clicar no botão de período → popover abre com atalhos + calendário; clicar "Este mês" aplica o filtro correto; selecionar um intervalo manual no calendário também aplica e fecha o popover.
- Arrastar a borda da coluna Descrição → largura muda em tempo real; recarregar a página → largura escolhida é mantida.
- Coluna Descrição com texto longo, antes do ajuste, continua truncando dentro do limite atual; depois de arrastar pra mais largo, mostra mais texto.
