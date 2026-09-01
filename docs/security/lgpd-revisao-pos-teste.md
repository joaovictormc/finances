# Revisão técnica de segurança e LGPD — correções pós-teste

**Data:** 25/07/2026  
**Natureza:** revisão técnica; não substitui parecer jurídico.

## Dados e finalidades afetados

| Dado | Finalidade | Retenção nesta entrega | Proteção aplicada |
|---|---|---|---|
| Arquivo CSV/OFX | Importar transações | somente em memória durante a requisição | autenticação, ownership, limites e parsing |
| Transações financeiras | visão geral e categorização | conforme banco da aplicação | escopo por usuário/grupo e ORM |
| Categoria aplicada | organização financeira | enquanto a transação existir | validação de tipo e autorização |
| ID de requisição | diagnóstico | somente logs operacionais | UUID sem conteúdo financeiro |

Os arquivos brutos não são gravados no banco, disco ou Redis.

## Controles implementados

- autenticação obrigatória nas rotas de transação;
- upload limitado a 20 arquivos, 10 MB por arquivo e 50 MB por lote;
- extensões aceitas: CSV e OFX;
- rate limit de 10 lotes/15 minutos por usuário via Redis;
- deduplicação por `externalId + accountId`;
- categorização limitada a 100 IDs explícitos;
- autorização “tudo ou nada” para categorização em massa;
- categoria visível ao usuário e compatível com o tipo da transação;
- timeout de 15 segundos nos clientes web;
- erros 500 genéricos com `X-Request-Id`;
- `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e
  `Permissions-Policy` no web;
- arquivos e payloads financeiros não são registrados nos logs novos.

## Dependências

Resultado inicial de `pnpm audit --prod`:

```text
46 vulnerabilidades: 1 crítica, 22 altas, 22 moderadas, 1 baixa
```

Ações:

- Next atualizado de 16.2.9 para 16.2.11;
- Hono atualizado para 4.12.27;
- `@hono/node-server` atualizado para 2.0.10;
- Better Auth atualizado para 1.6.22;
- `form-data <2.5.6` fixado em 2.5.6.

Resultado posterior:

```text
18 vulnerabilidades: 10 altas, 7 moderadas, 1 baixa
```

Não restaram ocorrências reportadas para Next, Hono, Better Auth ou
`form-data`. Os achados restantes são transitivos, principalmente:

- SDK Brevo → `request`/ferramentas legadas;
- Expo/React Native e ferramentas do mobile;
- Sharp/PostCSS transitivos.

Recomendação: substituir ou atualizar o SDK Brevo em uma entrega dedicada e
acompanhar releases compatíveis do Expo/mobile. Não promover para exposição
pública sem reavaliar os achados que atinjam o artefato efetivamente implantado.

## Criptografia de campo (segredos de pagamento / CPF / tokens Open Finance)

`UserProfile.cpf` e `OpenFinanceConsent.accessTokenEnc`/`refreshTokenEnc`
tinham comentários no schema afirmando "criptografado em nível de
aplicação" sem nenhuma implementação real — achado corrigido:

- criado `packages/db/src/crypto.ts` (`encryptField`/`decryptField`,
  AES-256-GCM via `node:crypto`, chave em `APP_ENCRYPTION_KEY`);
- confirmado por busca no código (`apps/`, `packages/`) que **nenhuma
  rota lê ou grava `cpf` hoje** (não existe endpoint de coleta) e o
  fluxo Open Finance (`accessTokenEnc`/`refreshTokenEnc`) também não
  está implementado — a integração ativa é via Pluggy. Não há dado em
  texto puro pra migrar porque nunca houve escrita nesses campos;
- comentários do schema corrigidos pra não afirmar proteção que não
  existe; quando esses campos ganharem um endpoint de escrita real, usar
  `encryptField`/`decryptField` obrigatoriamente, nunca gravar em texto
  puro.

Atualização de 01/09/2026 — o helper deixou de ser código sem uso: os
segredos de `PaymentMethodConfig` (access token e webhook secret do Mercado
Pago) passaram a ser gravados criptografados, com formato marcado (`enc:v1:`)
pra conviver com o que já estava em texto puro, backfill idempotente
(`pnpm --filter @finances/api secrets:encrypt`) e recusa explícita (`503`) se
`APP_ENCRYPTION_KEY` não estiver configurada. `cpf` e os tokens de Open
Finance continuam sem nenhuma escrita — a nota acima segue valendo pra eles.

## Lacunas organizacionais para LGPD

Ainda precisam de definição pelo controlador:

- bases legais por finalidade;
- prazos formais de retenção para transações, logs e backups;
- lista de operadores/suboperadores e transferências internacionais;
- processo verificável de atendimento aos direitos do titular;
- política e exercício de resposta a incidentes;
- processo de descarte/expurgo em backups;
- registro de riscos aceitos e responsáveis.

## Gate para homologação

Antes de promover:

1. validar TLS e secrets somente no ambiente;
2. executar exportação e exclusão com uma conta sintética;
3. confirmar que logs não contêm descrição, valor, token ou cookie;
4. testar acesso cruzado entre dois usuários e entre papéis de grupo;
5. repetir a auditoria de dependências no artefato/lockfile final;
6. documentar aceite dos achados transitivos restantes.

