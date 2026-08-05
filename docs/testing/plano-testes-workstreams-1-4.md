# Plano de testes — Workstreams 1-4 (ajustes pós-teste)

**Referência:** `docs/ajustes-pos-teste.md` e plano de implementação da sessão
(commits `2e9bb1d` e `ec57470` em `develop`).

**Escopo:** Workstream 1 (performance/loading), Workstream 2 (sugestão de
categoria por IA), Workstream 3 (diferenciação de pagamento de fatura de
cartão) e Workstream 4 (criptografia de campo CPF/tokens Open Finance).
Workstream 0 (verificação de itens já existentes) e Workstream 5 (redesign
visual) ficam fora deste documento.

## Pré-requisito

Rodar no servidor o runbook pendente (`docs/_scratch/deploy-pendente-schema.md`
ou a cópia salva no scratchpad local): `git pull`, `prisma db push`,
`db:seed`, rebuild/restart de `api` + `web`. Sem isso o Workstream 2 quebra
(coluna `categorySuggestionEnabled` ainda não existe na tabela).

## 1. Performance percebida (loading.tsx)

- Navegar entre todas as 17 rotas do dashboard (overview, transactions,
  accounts, bills, budgets, goals, groups, groups/[id], groups/join/[code],
  settings, settings/billing, bot, admin, admin/ai, admin/checkouts,
  admin/payment-methods, admin/users) e confirmar que aparece o spinner
  central instantaneamente, sem tela branca/travada.
- Testar em conexão lenta (throttle no DevTools) para garantir que o
  skeleton realmente cobre o tempo de carregamento.

## 2. Sugestão de categoria por IA

- Importar um extrato de teste com transações sem categoria óbvia.
- Selecionar transações não categorizadas → clicar "Sugerir categoria (IA)" →
  confirmar que aparecem chips de sugestão com % de confiança, **sem**
  aplicar sozinho.
- Aplicar uma sugestão → confirmar que `categoryId` foi gravado via
  `PATCH /:id` e a UI atualiza.
- Descartar uma sugestão → confirmar que o chip some sem alterar a
  transação.
- Testar limite de 50 transações por lote (tentar mais deve ser rejeitado
  pela validação).
- Em `/admin/ai`, desligar o toggle "Sugestão de categoria" e confirmar que
  o endpoint passa a recusar/desabilitar a feature.

## 3. Diferenciação de pagamento de fatura de cartão

- Importar CSV/OFX com uma linha do tipo "PAGAMENTO FATURA CARTAO" (e
  variações: "PGTO CART", "PAGTO CARTAO") → confirmar que a transação entra
  como `type: transfer`, categorizada automaticamente como "Pagamento de
  Fatura de Cartão".
- Conferir em `/overview` que esse valor **não** entra na soma de despesas
  nem de receitas do mês.
- Conferir em `/reports/monthly` (se exposto na UI) que o valor também fica
  de fora dos agregados de income/expense.
- Testar um caso que NÃO deveria casar com a heurística (ex: "pagamento de
  boleto" comum) para confirmar que continua como `expense` normal —
  checar falsos positivos.
- Reclassificar manualmente uma transação mal detectada via bulk-category e
  confirmar que funciona normalmente.

## 4. Criptografia de campo (CPF/tokens)

- Não há fluxo de escrita ativo hoje (confirmado na investigação), então o
  teste aqui é de regressão: confirmar que `prisma generate`/`typecheck`/
  build da API continuam passando após o pull no servidor.
- Validação funcional fica pendente até existir um endpoint real de CPF ou
  Open Finance — nesse momento, testar gravando um valor de teste e
  conferindo direto no Postgres (`SELECT cpf FROM user_profiles`) que não
  está em texto puro, e que a leitura pela API devolve o valor correto
  decriptado.

## Regressão geral

- Login/sessão (dado o histórico recente de bug em produção) continua
  funcionando após o rebuild.
- Fluxo de importação em lote (múltiplos arquivos) segue funcionando
  normalmente com as novas regras de tipo aplicadas.
