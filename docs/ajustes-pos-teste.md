# Identificação de itens que necessitam de correções durante o teste do app web

### Visão Geral
- [OK] Durante os testes no linux de homologação, a tela de visão geral não abre de forma natural, somente passando /overview na url. Mesmo assim, passando o destino na url ela não carregava os balanços de transação já cadastrado. — investigado: não é bug de código (`/` já redireciona pra `/overview` corretamente e a tela carrega normal com banco saudável, testado localmente). Causa raiz é o schema drift do banco de homolog (mesmo problema do `categorySuggestionEnabled` na seção "Tratamento de erros e alertas" abaixo). Corrige rodando `pnpm exec prisma migrate deploy` (ou `db push`) contra o banco de homolog assim que ele estiver acessível.


### Importação de extratos
- [OK] Importação está muito manual, quando uma pessoa precisar de importar o extrato de varios meses ela precisa selecionar um arquivo, importar e depois repetir o processo várias vezes. Podemos redefinir essa função deixando possível importar arquivos em massa tanto para área de cartão de crédito como extrato de conta corrente (`ImportForm` já suporta multi-arquivo com slots separados débito/crédito + `POST /api/transactions/import/batch`, até 20 arquivos/50MB por lote, duplicatas ignoradas automaticamente)

### Transações
- [OK] Podemos realizar uma funcionalidade para fazer uma conciliação das categorias de transções em massa ao invés de realizar uma por uma, pois após ser importado elas não possuem categoria definida (seleção múltipla + `/api/transactions/bulk-category` em `transactions/page.tsx`)

### Desempenho do backend/frontend
- [OK] Algumas operações simples, como troca de tela, estão demorando para serem processadas, ficam em loading infinito ou levam um tempo considerável para abrir — investigado: sem N+1 nem query pesada nas rotas mais usadas, sessão já cacheada (`cookieCache`, 5min) no `better-auth`. Mesma causa raiz dos itens acima: schema drift/instabilidade do banco de homolog derruba/trava requisições e a UI fica presa no loading state. Resolve junto com o `migrate`/`db push` no ambiente remoto.


### Layout e design
- [OK] Quando clico no collapse do menu lateral, podemos incluir o botão de abrir o menu novamente por cima da logomarca do app, quando o usuário passar o mouse por cima da logo o botão aparece aplicando um blur por cima da logo e mostrando o icone de abir menu

- [OK] Usar Skill: https://github.com/pbakaus/impeccable para refatorar o frontend deixando um visual exclusivo e diferente na web e mobile (direção "Fechamento de Caixa" aplicada na web inteira e nos tokens/componentes compartilhados do mobile; validação tela a tela do mobile ainda em andamento)

- [OK] Ajuste nas telas de novas operações como: novas transações, novo orçamento, nova meta, nova conta a pagar, nova conta bancária, criar grupo. Ao invés de abrir uma aba lateral, podemos optar por uma tela flutuante sobrepondo a tela princiapl com o fundo desfocado (componente `Modal` substituindo `Drawer` nessas 6 telas)

- [OK] Adicionar botão de voltar nas áreas em que temos telas internas dentro de cada função (componente `BackButton` em `components/ui/back-button.tsx`, adicionado em `/groups/[id]` → Família/Grupo, `/settings/billing` → Configurações, `/admin/ai`, `/admin/checkouts`, `/admin/payment-methods`, `/admin/users` → Administração)


### Ajustes do backend
- [OK] Como estou testando a aplicação em ambiente diferente do de desenvolvimento, as categorias de transações não estão aparecendo nesse ambiente — mesma causa raiz do item "Visão Geral" acima: schema drift no banco desse ambiente (nunca rodou `prisma migrate`/`db push` nele). Resolve rodando a migration lá.


### Segurança de dados, operações e LGPD
- [OK] Valide se todas as operções e arquivos definidos estão de acordo com a LGPD e se estão bem protegidos — auditoria técnica completa em `docs/security/lgpd-revisao-pos-teste.md` (25/07/2026): export/exclusão de conta implementados (`GET /api/user/export`, `authClient.deleteUser`), CORS restrito, cookies `httpOnly`/`sameSite=lax`/`secure` condicional a HTTPS, rate limit de import via Redis, criptografia de campo AES-256-GCM pronta (`packages/db/src/crypto.ts`) pra CPF/tokens quando esses campos ganharem endpoint real, dependências atualizadas (`pnpm audit` de 46→18 achados, nenhum em Next/Hono/Better Auth). Restam só lacunas organizacionais (bases legais, prazos de retenção, registro de operadores) — decisão do controlador do negócio, fora do escopo de código.


### Sugestão de categorias com IA
- [OK] Verificar e sugerir a atribuição de categorias para as transações, não categorizar automático, somente sugestão (endpoint `POST /api/transactions/suggest-categories` + chip aplicar/descartar em `/transactions` — mas depende do `categorySuggestionEnabled` que hoje quebra, ver "Tratamento de erros e alertas" abaixo)

- [OK] Diferenciar pagamentos de faturas de cartão para não ser inclusas como dinheiro recebido (heurística em `apps/api/src/lib/import/credit-card-payment.ts`, marca como `type=transfer`)


### Tratamento de erros e alertas
- [OK] Quando algum alerta é exibido no sistema, aparece sempre um popup do navegador, vamos tratar corretamente essas caixas criando alertas flutuantes dentro do próprio sistema (novo `ConfirmProvider`/`useConfirm` em `components/ui/confirm-provider.tsx`, montado no layout do dashboard; substituídas as 12 chamadas de `window.confirm`/`confirm` em transactions, budgets, bills, goals, accounts (x2), groups/[id] (x3), settings/billing e admin/users — nenhuma chamada nativa de confirm/alert restante em `apps/web`)

- [OK] Correção de erro da área do modelo de IA que ao entrar recebo esse erro no backend — mesma causa raiz dos itens "Visão Geral"/"Ajustes do backend" acima: coluna `ai_settings.categorySuggestionEnabled` existe no `schema.prisma` mas nunca foi aplicada no banco daquele ambiente (schema drift, sem histórico de migrations no repo). Resolve rodando `pnpm exec prisma migrate deploy` (ou `db push`) contra o banco daquele ambiente; localmente já validado que `db:migrate`/`db:seed` aplicam o schema corretamente (ver conversa) :
    (prisma:error 
Invalid `db.aiSettings.upsert()` invocation in
C:\Users\jvmac\Documents\GitHub\finances\apps\api\src\lib\ai\ai-settings.ts:14:24

  11   | "category_suggestion";
  12
  13 export async function getAiSettings() {
→ 14   return db.aiSettings.upsert(
The column `ai_settings.categorySuggestionEnabled` does not exist in the current database.
[api] erro não tratado [ab52a93d-a76a-4513-a37b-ff4bcf665204]: PrismaClientKnownRequestError: 
Invalid `db.aiSettings.upsert()` invocation in
C:\Users\jvmac\Documents\GitHub\finances\apps\api\src\lib\ai\ai-settings.ts:14:24

  11   | "category_suggestion";
  12
  13 export async function getAiSettings() {
→ 14   return db.aiSettings.upsert(
The column `ai_settings.categorySuggestionEnabled` does not exist in the current database.
    at ei.handleRequestError (C:\Users\jvmac\Documents\GitHub\finances\node_modules\.pnpm\@prisma+client@6.19.3_prism_1d040ab5215f59f0e27ddee7f0cf082e\node_modules\@prisma\client\src\runtime\RequestHandler.ts:228:13)
    at ei.handleAndLogRequestError (C:\Users\jvmac\Documents\GitHub\finances\node_modules\.pnpm\@prisma+client@6.19.3_prism_1d040ab5215f59f0e27ddee7f0cf082e\node_modules\@prisma\client\src\runtime\RequestHandler.ts:174:12)
    at ei.request (C:\Users\jvmac\Documents\GitHub\finances\node_modules\.pnpm\@prisma+client@6.19.3_prism_1d040ab5215f59f0e27ddee7f0cf082e\node_modules\@prisma\client\src\runtime\RequestHandler.ts:143:12)
    at async a (C:\Users\jvmac\Documents\GitHub\finances\node_modules\.pnpm\@prisma+client@6.19.3_prism_1d040ab5215f59f0e27ddee7f0cf082e\node_modules\@prisma\client\src\runtime\getPrismaClient.ts:833:24)
    at async <anonymous> (C:\Users\jvmac\Documents\GitHub\finances\apps\api\src\routes\admin.ts:226:20)
    at async dispatch (C:\Users\jvmac\Documents\GitHub\finances\node_modules\.pnpm\hono@4.12.32\node_modules\hono\dist\cjs\compose.js:43:17)
    at async <anonymous> (C:\Users\jvmac\Documents\GitHub\finances\apps\api\src\middleware\admin.ts:14:5)
    at async dispatch (C:\Users\jvmac\Documents\GitHub\finances\node_modules\.pnpm\hono@4.12.32\node_modules\hono\dist\cjs\compose.js:43:17)
    at async <anonymous> (C:\Users\jvmac\Documents\GitHub\finances\apps\api\src\middleware\auth.ts:19:5)
    at async dispatch (C:\Users\jvmac\Documents\GitHub\finances\node_modules\.pnpm\hono@4.12.32\node_modules\hono\dist\cjs\compose.js:43:17) {
  code: 'P2022',
  meta: {
    modelName: 'AiSettings',
    column: 'ai_settings.categorySuggestionEnabled'
  },
  clientVersion: '6.19.3'
})


### Novas Funcionalidades
- [OK] Gameficação: 
  > Discutir e analisar propostas para gameficar a aplicação para tornar um diferencial do projeto, como cumprimento de metas semanais, mini jogos para atrair o usuário e deixar o registro diário financeiro mais atrativo e diversificado
  >
  > Implementado: novo model `GamificationProfile` (pontos, nível, streak diário de transações registradas), `awardDailyPoints` disparado a cada transação criada, job semanal (`gamification.worker.ts`, seg 06h) que gera um `AiInsight` tipo `weekly_recap` no `InsightsPanel`, e mini-jogo "Roleta Semanal" (`POST /api/gamification/spin`, sorteio server-side, idempotente por semana, desbloqueia com 7 dias de streak). Card `GamificationCard` na Visão Geral (web) e na Home (mobile), reaproveitando o `ProgressRing`. De quebra, corrigido um bug pré-existente (`Transaction.aiTags` sem `@default([])`, causava `P2011` em qualquer criação de transação).
  >
  > Painel admin (`/admin/gamification`): gerenciamento dos prêmios da Roleta Semanal — cada prêmio tem rótulo livre (ex: "Cupom de desconto") e pontos aplicados (`GamificationSettings.spinPrizes`, `Json`).
- Leitura de cupom fiscal/nf-e
  > inserir no app mobile uma feature que pode ser inserida a partir do plano pro que é o envio de foto diretamente pelo app de cupom fiscal, notinhas de maquininhas de cartão, nf-e, etc, e abra um menu para edição dessa transação, realizar a pré classificação antes do usuário cadastrar via IA
- Desenvolver a integração via whatsapp
  > Como já existe o bot do telegram, podemos em paralelo configurar e inserir o bot para whatsapp selehante ao do telegram