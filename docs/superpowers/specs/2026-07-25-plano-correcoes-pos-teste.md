# Plano de desenvolvimento — correções pós-teste em homologação

**Data:** 25/07/2026  
**Origem:** `docs/ajustes-pos-teste.md`  
**Escopo:** aplicação web, API, banco e implantação em Linux/homologação

## 1. Objetivo

Corrigir os problemas encontrados em homologação sem misturar diagnóstico de
infraestrutura, correções de defeitos e novas funcionalidades. O trabalho deve
entregar:

- entrada previsível na área autenticada e visão geral com dados corretos;
- categorias de sistema disponíveis em todos os ambientes;
- importação de vários extratos com relatório individual por arquivo;
- categorização em massa segura;
- navegação sem loading infinito e com erros observáveis;
- comportamento solicitado para a sidebar recolhida;
- controles técnicos e documentação mínima para segurança e LGPD.

## 2. Evidências já confirmadas no código

| Item anotado | Evidência | Interpretação para o plano |
|---|---|---|
| Acesso à visão geral | `apps/web/app/page.tsx` já redireciona `/` para `/overview`; `apps/web/proxy.ts` redireciona usuários autenticados para `/overview` | O erro não deve ser tratado como simples ausência de redirect. É necessário reproduzir em build Docker e validar cookie, proxy e URL interna da API. |
| Saldos não aparecem | A página de overview captura qualquer erro das chamadas server-side e converte em `null`/listas vazias | Falha de autenticação, rede ou API é apresentada como ausência de dados. Primeiro tornar o erro observável, depois corrigir a causa. |
| Lentidão | A overview faz nove chamadas à API por acesso; a tela de transações chama `loadTransactions` em dois efeitos na montagem | Há oportunidades concretas de reduzir round trips e requisições duplicadas. Loading infinito também precisa de timeout/cancelamento e estado de erro. |
| Importação | API e UI aceitam um arquivo por tipo; dois arquivos podem ser enviados em paralelo. A API usa `createMany(..., skipDuplicates: true)` | Evoluir para lote preservando idempotência, autorização por conta e resultado por arquivo. |
| Categorização | Existe edição unitária por `PATCH /api/transactions/:id`; não há endpoint nem seleção em massa | Criar contrato específico para atualização em lote, sem repetir chamadas unitárias no navegador. |
| Categorias ausentes | Existe seed idempotente em `packages/db/src/seed.ts`, mas o compose/deploy não garante sua execução | Separar aplicação de schema e sincronização de dados de referência; o seed deve ser um passo explícito e repetível de deploy. |
| Sidebar | O botão de expandir já existe quando recolhida, mas ocupa o cabeçalho no lugar da logo | Ajustar a interação para logo + overlay com blur no hover/foco, mantendo acesso por teclado. |

As causas de autenticação/rede em homologação ainda são hipóteses. Não alterar
configuração com base apenas nelas; coletar evidência na Fase 0.

## 3. Prioridade e dependências

```text
Fase 0 — reprodução e observabilidade
   ├── Fase 1 — entrada, overview e dados
   ├── Fase 2 — categorias no deploy
   └── Fase 3 — desempenho e estados de erro
          ├── Fase 4 — importação em lote
          └── Fase 5 — categorização em massa

Fase 6 — sidebar (independe das fases funcionais)
Fase 7 — segurança e LGPD (audita todas as entregas)
Fase 8 — regressão e homologação final
```

Ordem recomendada de entrega: **0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8**.
As fases 4, 5 e 6 podem ser desenvolvidas em paralelo depois de estabilizada a
base, desde que não compartilhem o mesmo PR.

## 4. Plano por fase

### Fase 0 — Reproduzir e medir a homologação

**Objetivo:** obter uma linha de base e distinguir falha de aplicação de falha
de configuração.

**Tarefas**

1. Subir exatamente o build de homologação com `docker-compose.staging.yml`.
2. Registrar, sem incluir segredos:
   - URL acessada pelo navegador;
   - status e destino dos redirects `/`, `/login` e `/overview`;
   - presença do cookie de sessão;
   - status e duração de `/api/auth/get-session`,
     `/api/transactions/reports/monthly`, `/api/transactions`,
     `/api/categories`, `/api/goals` e `/api/bills`;
   - logs correlacionados do web e da API.
3. Confirmar `API_INTERNAL_URL`, URLs do Better Auth, origem permitida no CORS,
   conectividade web → API e relógio/timezone dos containers.
4. Criar um roteiro reprodutível com usuário, conta e transações sintéticas.
5. Definir metas iniciais de homologação:
   - nenhuma requisição deve permanecer indefinidamente;
   - navegação deve sempre terminar em conteúdo ou erro acionável;
   - p95 das rotas simples da API abaixo de 500 ms na rede local;
   - overview utilizável em até 2 s, desconsiderando cold start documentado.

**Saída:** relatório de reprodução anexado ao PR, com causa confirmada ou
hipótese descartada para cada sintoma.

### Fase 1 — Corrigir entrada e dados da visão geral

**Arquivos principais**

- `apps/web/app/page.tsx`
- `apps/web/proxy.ts`
- `apps/web/app/(dashboard)/overview/page.tsx`
- `apps/web/lib/api-server.ts`
- `apps/api/src/routes/transactions.ts`
- configuração Docker/ambiente, somente se a Fase 0 comprovar drift

**Tarefas**

1. Testar a matriz: sem sessão, sessão válida, sessão expirada e acesso direto
   a `/overview`.
2. Corrigir cookie/origem/rewrite/API interna conforme a evidência coletada.
3. Não converter indisponibilidade da API em “Sem dados para este mês”.
   Modelar separadamente:
   - resposta válida com totais zero;
   - sessão inválida;
   - timeout/indisponibilidade;
   - erro inesperado com identificador de correlação.
4. Validar o período mensal com datas na fronteira do mês e timezone
   `America/Sao_Paulo`; padronizar cálculo de intervalo no backend.
5. Verificar que as consultas do relatório respeitam o mesmo escopo de dados
   adotado na listagem (pessoal/grupo e limite histórico do plano). Documentar
   qualquer diferença deliberada.
6. Adicionar tela de erro/retry e logs estruturados sem dados financeiros.

**Critérios de aceite**

- `/` encaminha corretamente o usuário autenticado para uma overview funcional;
- usuário não autenticado retorna ao login e depois ao destino solicitado;
- transações do mês aparecem nos totais e na lista recente;
- falha da API nunca aparece como saldo zero;
- testes cobrem sessão, mês vazio, mês com dados e indisponibilidade da API.

### Fase 2 — Tornar categorias parte do deploy

**Arquivos principais**

- `packages/db/src/seed.ts`
- `packages/db/package.json`
- `docker-compose.staging.yml`
- documentação/script de implantação

**Tarefas**

1. Confirmar no banco de homologação a contagem de categorias por tipo e
   `isSystem`.
2. Manter um único seed canônico. Evitar divergência entre `seed.ts` e
   `sql/002_seed_categories.sql`.
3. Garantir IDs estáveis e execução idempotente por `upsert`.
4. Criar etapa explícita de release:
   1. aplicar schema;
   2. executar seed/sincronização de dados de referência;
   3. iniciar ou liberar a API;
   4. executar health check que valide categorias mínimas.
5. Falhar o deploy com mensagem clara se schema ou categorias essenciais não
   forem aplicados.
6. Documentar rollback sem apagar categorias já referenciadas por transações.

**Critérios de aceite**

- banco vazio recebe todas as categorias no primeiro deploy;
- repetir o deploy não duplica nem remove categorias;
- ambiente existente é reconciliado sem perder referências;
- `/api/categories` retorna categorias para um usuário autenticado.

### Fase 3 — Desempenho, timeout e loading

**Tarefas**

1. Remover a chamada duplicada de transações na montagem da página.
2. Medir as nove chamadas da overview e escolher entre:
   - endpoint agregador de dashboard; ou
   - consolidação dos seis relatórios mensais em uma única consulta/rota.
3. Adicionar timeout com `AbortController`, cancelamento em troca de filtros e
   proteção contra respostas antigas sobrescreverem as novas.
4. Padronizar estados `loading`, `empty`, `error` e `success`.
5. Incluir `loading.tsx`/skeleton apenas onde melhora a percepção, sem esconder
   timeout real.
6. Revisar consultas lentas com `EXPLAIN ANALYZE` usando volume representativo;
   criar índice somente com evidência.
7. Registrar duração, rota, status e correlation ID na API. Não registrar
   payload, descrição de transação, cookie ou token.

**Critérios de aceite**

- uma troca de filtro produz uma única requisição efetiva;
- toda requisição termina, é cancelada ou exibe erro com opção de tentar de novo;
- metas da Fase 0 são atendidas ou há exceção quantificada e documentada;
- não há regressão nos totais do dashboard.

### Fase 4 — Importação de extratos em lote

**Decisão de produto proposta**

Uma operação pode conter vários arquivos de débito e vários de crédito para
uma única conta. Cada arquivo mantém seu próprio status; falha em um arquivo
não desfaz arquivos já validados, e a tela apresenta resumo final. Limites
iniciais devem ser configuráveis (quantidade, tamanho por arquivo e total).

**Tarefas**

1. Definir schema compartilhado e limites de upload.
2. Permitir `multiple` nos dois seletores, lista de arquivos, remoção antes do
   envio, progresso e resultado por arquivo.
3. Criar endpoint de lote ou contrato de sessão de importação. Não disparar
   dezenas de requests sem controle de concorrência.
4. Validar extensão, assinatura/conteúdo, encoding, quantidade de linhas e
   ownership da conta no servidor.
5. Preservar `externalId + accountId` como barreira de duplicidade e apresentar
   contagens de importadas, duplicadas e inválidas por arquivo.
6. Para lotes grandes, mover processamento para fila e permitir consultar o
   status; definir expiração e limpeza dos arquivos temporários.
7. Não persistir arquivo bruto além do necessário. Se retenção for necessária,
   criptografar, definir prazo e registrar a finalidade.

**Critérios de aceite**

- importa vários meses de débito e crédito numa operação;
- reenvio do mesmo lote não duplica transações;
- arquivo inválido não impede o relatório dos demais;
- usuário nunca importa para conta fora do seu escopo;
- testes cobrem lote misto, duplicidade, limites e falha parcial.

### Fase 5 — Categorização de transações em massa

**Decisão de produto proposta**

Adicionar seleção por página e ação “Definir categoria”. A primeira versão
deve operar sobre uma lista explícita de IDs; “selecionar todos os resultados
do filtro” fica para uma evolução posterior, pois exige snapshot/contrato de
filtro e maior proteção contra atualização acidental.

**Tarefas**

1. Criar schema `{ transactionIds, categoryId }`, com limite máximo por lote.
2. Implementar rota transacional de atualização em massa que:
   - aplique exatamente as mesmas regras de autorização da edição unitária;
   - valide compatibilidade entre tipo da transação e categoria;
   - atualize somente registros autorizados;
   - retorne contagens e IDs rejeitados sem revelar registros alheios.
3. Adicionar checkboxes, seleção da página, contador, confirmação e limpeza da
   seleção após sucesso.
4. Invalidar/recarregar lista, dashboard e relatórios afetados.
5. Registrar auditoria mínima da operação em massa (ator, horário, quantidade
   e resultado), sem copiar descrições financeiras para logs.

**Critérios de aceite**

- usuário categoriza várias transações autorizadas em uma operação;
- transação de outro usuário/grupo nunca é alterada;
- categoria incompatível é rejeitada;
- falha não deixa um resultado parcial silencioso;
- totais e gráficos refletem a atualização.

### Fase 6 — Interação da sidebar recolhida

**Arquivo principal:** `apps/web/components/ui/dashboard-sidebar.tsx`

**Tarefas**

1. Manter a logo visível no estado recolhido.
2. No hover **e no foco de teclado**, sobrepor o botão de expandir à logo com
   blur/contraste suficiente e transição curta.
3. Manter `title`, adicionar nome acessível e área clicável mínima de 44×44 px.
4. Respeitar `prefers-reduced-motion`.
5. Validar tema claro/escuro, zoom de 200% e navegação por teclado.

**Critérios de aceite:** o menu pode ser expandido por mouse e teclado, sem
layout shift nem perda da identidade visual.

### Fase 7 — Segurança e LGPD

Esta fase é uma auditoria técnica; conformidade jurídica final exige validação
com profissional responsável e documentação organizacional fora do código.

**Inventário e base legal**

1. Mapear dados por finalidade: conta, autenticação, finanças, integrações,
   billing, bot, IA, logs, backups e arquivos importados.
2. Para cada classe, registrar finalidade, base legal, retenção, destinatários,
   operador/suboperador e fluxo internacional.
3. Revisar avisos de privacidade e consentimentos quando a base for consentimento.

**Controles técnicos**

1. Testar autorização horizontal em todas as rotas por `userId`/`groupId`.
2. Revisar cookies, CORS, CSRF, rate limiting, headers, TLS, secrets e webhooks.
3. Garantir criptografia em trânsito e em repouso para banco, backup e arquivos.
4. Mascarar segredos e remover PII/dados financeiros de logs e erros.
5. Definir retenção e descarte para uploads, filas, logs, exports e backups.
6. Validar exportação/portabilidade, exclusão da conta e propagação para
   integrações e backups conforme política documentada.
7. Rodar análise de dependências e revisão de configuração do container.
8. Criar procedimento de incidente: detecção, contenção, evidências, avaliação
   de risco e comunicação ao controlador/ANPD/titulares quando aplicável.

**Critérios de aceite**

- matriz de dados e ameaças anexada;
- achados críticos/altos corrigidos antes da liberação;
- direitos de acesso, portabilidade e exclusão têm testes;
- riscos aceitos possuem responsável, justificativa e prazo.

### Fase 8 — Regressão e nova rodada de homologação

1. Criar suíte automatizada mínima para API (Vitest) e fluxos web críticos
   (Playwright): login/redirect, overview, categorias, importação e
   categorização em massa.
2. Executar em cada PR:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

3. Executar `npm audit`/auditoria equivalente do lockfile e classificar achados.
4. Fazer smoke test no container Linux, não apenas em desenvolvimento local.
5. Repetir todos os itens de `docs/ajustes-pos-teste.md` e registrar
   evidência “antes/depois”.
6. Liberar em staging; somente promover após um ciclo sem erro crítico.

## 5. Pacotes de entrega sugeridos

| PR | Conteúdo | Dependência | Rollback |
|---|---|---|---|
| PR 1 | Observabilidade, estados de erro e roteiro de reprodução | nenhuma | remover instrumentação visual; preservar logs úteis |
| PR 2 | Redirect/sessão/overview e consultas mensais | PR 1 | reverter rotas/queries sem alterar dados |
| PR 3 | Seed idempotente e gate de deploy | PR 1 | manter dados; retirar apenas o gate |
| PR 4 | Timeouts, cancelamento e otimização de chamadas | PR 2 | voltar ao fetch anterior por feature flag, se necessário |
| PR 5 | Importação em lote | PR 3 e 4 | desabilitar UI/rota nova; transações importadas permanecem válidas |
| PR 6 | Categorização em massa | PR 3 e 4 | desabilitar ação; não desfazer categorias já confirmadas |
| PR 7 | Sidebar acessível | nenhuma | revert puramente visual |
| PR 8 | Hardening LGPD/segurança e suíte final | todos | rollback por controle, nunca reexpor falha crítica |

Cada PR deve incluir testes, evidência de execução, impacto no deploy e
instruções de rollback. Mudanças de banco devem ser compatíveis com a versão
anterior da aplicação durante a implantação.

## 6. Fora de escopo desta rodada

- categorização automática por IA;
- seleção irrestrita de todas as transações de uma busca;
- redesign completo do dashboard;
- certificação ou parecer jurídico de conformidade;
- alteração do provedor de infraestrutura;
- armazenamento permanente dos extratos brutos.

## 7. Definição de pronto

O plano estará concluído quando todos os critérios abaixo forem verdadeiros:

- todos os sintomas originais têm causa documentada e teste de regressão;
- build e testes passam;
- smoke test Linux passa com banco novo e banco existente;
- nenhum loading infinito ou erro mascarado como estado vazio;
- importação e categorização em massa respeitam autorização e idempotência;
- categorias são provisionadas automaticamente;
- não existem achados críticos ou altos de segurança sem tratamento;
- evidências da nova rodada foram anexadas ao documento de teste.
