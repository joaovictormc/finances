# Mobile — Roadmap de continuidade + Redesign visual (Finans)

> Data: 2026-06-27 · Status: em andamento

## Contexto

Continuação do app mobile (Expo Router v6 / Expo SDK 54 / NativeWind). A Fundação e o
MVP de telas reais (Visão Geral, Transações, Contas) já estão concluídos; Contas a Pagar
e Metas foram criadas mas ainda não verificadas/commitadas. Esta spec registra (1) o
roadmap por fases para fechar paridade com o web e (2) a direção de **redesign visual**
inspirada no design **Finans — Finance Mobile App** (`layouts/Finans - Finance Mobile App/`),
com foco inicial na **tab bar** (menu inferior) fora do padrão convencional.

## Parte A — Roadmap por fases

| Fase | Escopo | Complexidade |
|---|---|---|
| **0** | Verificar + commitar Bills/Goals (hoje untracked); `typecheck` verde | Baixa |
| **1** | Orçamentos (`app/budgets.tsx` + `new-budget` modal, `GET/POST /api/budgets`) | Média |
| **2** | Editar/Excluir Transações, Contas, Bills, Goals (`PATCH`/`DELETE`) | Média |
| **3** | Grupos / compartilhamento (`groups`, join por código, deep link) | Média-Alta |
| **4** | Débito/Crédito + métodos de pagamento na transação (a "Fase 8" adiada) | Média |
| **5** | Configurações + Assinatura/Billing (checkout externo via `expo-web-browser`) | Média-Alta |
| **6** | Import / Open Banking (Pluggy) | Alta |
| **7** | Push (`expo-notifications`), biometria (`expo-local-authentication`), offline | Alta |

Sequência recomendada: **0 → 1 → 2** (core + CRUD faltante) → 3–4 → 5–7.

A API já expõe tudo em `apps/api/src/routes/` (`budgets`, `groups`, `goals`, `bills`,
`pluggy`, `billing`, `reports`, `transactions`, `financial-accounts`).

## Parte B — Redesign visual "Finans"

### Design tokens (extraídos dos SVGs em `layouts/Finans .../(Copy) (1)`)

| Token | Hex | Uso |
|---|---|---|
| **primary** (brand) | `#FEDC33` | FAB central, pílulas/seletores ativos, destaques, stroke de gráfico |
| primary tints | `#FEE877` `#FEED99` `#FFF3BB` `#FFF8D6` | fundos suaves do amarelo |
| **navy** (texto/escuro) | `#14142B` | títulos, ícone ativo da tab bar, superfícies escuras |
| **blue-grey** (inativo) | `#95A4B7` | ícones/labels inativos da tab bar, legendas |
| greys | `#949494` `#807F7E` `#BEBEBE` `#E4E4E4` `#EFEFEF` | bordas, textos secundários |
| background | branco / cinza-claro com leve gradiente quente no topo | telas |
| income / expense | verde / vermelho-escuro | valores de transação |

Cards: brancos, cantos ~`rounded-2xl`, sombra suave. Tipografia: sans geométrica,
títulos em navy bold.

### Tab bar (foco inicial)

Padrão observado nas telas Homepage/Activity/Statistic do Finans:

- Barra branca inferior com **5 slots**: `Home · Statistic · [FAB] · Activity · Card`.
- **FAB central**: círculo grande **amarelo `#FEDC33`** elevado acima da barra, com ícone
  de ação principal (no Finans é "scan QR"; no nosso app mapeia para **+ Nova transação**).
- Item ativo: ícone + label em **navy `#14142B`**; inativos em **blue-grey `#95A4B7`**.
- Ícone acima de label pequeno.

Mapeamento para o nosso app (4 abas atuais + FAB):
`Visão Geral · Transações · [FAB +] · Contas · Mais`.

### Componentes a padronizar depois (Parte B continua)
- Card de saldo (bandeira + bandeira do cartão + saldo grande + número mascarado).
- Pílulas de ação (Request/Transfer → no nosso caso ações contextuais).
- Seletor segmentado de mês (pílula ativa amarela).
- Gráfico de linha (stroke amarelo + fill em gradiente + marcadores + labels).
- Linhas de transação (ícone circular com seta, título, subtítulo, valor colorido).

## Verificação
- `pnpm --filter @finances/mobile typecheck` sem erros.
- Tab bar custom renderiza com FAB central amarelo; aba ativa em navy, inativas blue-grey;
  FAB abre `new-transaction`.
- Paleta Finans aplicada nos tokens (`tailwind.config.js` + `theme.tsx`) sem quebrar as
  telas existentes (modo claro e escuro).

## Fora de escopo (deste passo)
Refazer todas as telas internas de uma vez — o redesign começa pela tab bar + tokens; as
telas são migradas incrementalmente nas fases seguintes.
