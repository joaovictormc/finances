# Cadastro de contas focado em fluxo manual (Pluggy desativado por custo)

## Contexto

O Pluggy (agregador de Open Finance usado para conectar bancos automaticamente) tem custo mensal alto para o estágio atual do produto. Em vez de manter a opção de conexão automática visível e gerando expectativa de uso, o escopo da tela de Contas muda para priorizar o fluxo manual: cadastro manual de conta + atualização de saldo/transações via import de extrato (CSV/OFX), que já existe no projeto mas hoje vive desacoplado, na tela de Transações.

O código do Pluggy (componente `ConnectBankButton`, rotas `apps/api/src/routes/pluggy.ts`, worker de sync) **não é removido** — fica desativado via feature flag, para religar facilmente quando o custo deixar de ser um problema.

## Mudanças

### 1. Feature flag do Pluggy

- Nova env var `NEXT_PUBLIC_ENABLE_PLUGGY` (web), default ausente/`false`.
- Em `apps/web/app/(dashboard)/accounts/page.tsx`, `<ConnectBankButton onConnected={load} />` só renderiza quando `process.env.NEXT_PUBLIC_ENABLE_PLUGGY === "true"`.
- Documentar a variável em `.env.example` com comentário citando o motivo (custo mensal do Pluggy).
- Nenhuma outra rota/worker do Pluggy é alterada ou removida.

### 2. Import de extrato migra para o card da conta

- Remover o botão "Importar extrato" e o `Drawer`/estado relacionado de `apps/web/app/(dashboard)/transactions/page.tsx`. O componente `ImportForm` (`apps/web/components/transactions/import-form.tsx`) é reaproveitado, não duplicado.
- Em `accounts/page.tsx`, cada card de conta ganha uma faixa de status na base (ver seção 4 — Opção B do mockup) com um botão "📄 Importar".
- Ao clicar, abre o mesmo `Drawer`/`ImportForm`, mas com `accountId` da conta já fixado (não precisa escolher a conta de novo) e título "Importar extrato — {nome da conta}". O seletor de conta dentro do `ImportForm` fica oculto quando `accountId` é passado como prop fixa.

### 3. Indicador de defasagem (`lastSyncedAt`)

- Regra de cor, calculada a partir de `account.lastSyncedAt`:
  - `< 15 dias`: neutro — "Atualizado há N dias"
  - `15–29 dias`: amarelo (⚠) — "Atualizado há N dias"
  - `>= 30 dias`: vermelho (🔴) — "Atualizado há N dias"
  - `lastSyncedAt` nulo (conta nunca importada): neutro — "Nunca atualizado" (sem alarme, pode ser conta nova)
- Backend: `POST /api/transactions/import` (`apps/api/src/routes/transactions.ts`) passa a atualizar `lastSyncedAt = new Date()` na conta de destino (`accountId` do form-data) ao final do processamento — hoje essa rota não toca o campo.

### 4. Layout do card de conta (mockup validado — Opção B)

Faixa de status com fundo levemente colorido (conforme a regra da seção 3) na base do card, separada visualmente do corpo (nome/tipo/ações), contendo a mensagem de defasagem à esquerda e o botão "📄 Importar" à direita.

```
┌─────────────────────────────┐
│ 🏦 Nubank          Editar   │
│    Conta Corrente  Arquivar │
├─────────────────────────────┤ ← faixa de status (cor conforme defasagem)
│ ⚠ Atualizado há 18 dias  [📄 Importar] │
└─────────────────────────────┘
```

## Fora de escopo

- Lembretes automáticos por Telegram/e-mail sobre contas desatualizadas (fica para uma fase futura).
- Resumo pós-import (contagem de novas vs. ignoradas) já existe no toast atual — não muda.
- Qualquer alteração nas rotas/lógica interna do Pluggy além da flag de exibição.

## Verificação

- `pnpm --filter @finances/web typecheck` e `pnpm --filter @finances/api typecheck` sem erros.
- Com `NEXT_PUBLIC_ENABLE_PLUGGY` ausente/`false`: botão Pluggy não aparece em `/accounts`; com `=true`, volta a aparecer (sem alterações de código).
- Criar conta nova → faixa mostra "Nunca atualizado". Importar um extrato pelo card → faixa atualiza para "Atualizado há 0 dias" e some o estado de alerta.
- Manipular `lastSyncedAt` de uma conta de teste para 20 e 35 dias atrás (via script temporário, padrão já usado no projeto) e confirmar troca de cor amarelo → vermelho.
- Tela de Transações não mostra mais botão de import; importar segue funcionando normalmente pelo card.
