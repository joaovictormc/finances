# Evidências TDD — correções pós-teste

**Plano:** `docs/superpowers/specs/2026-07-25-plano-correcoes-pos-teste.md`  
**Data:** 25/07/2026

## Jornadas cobertas

1. Como usuário, quero que o relatório mensal use o mês de São Paulo em
   qualquer servidor, para que os saldos sejam iguais no Windows e no Linux.
2. Como usuário, quero selecionar transações e aplicar uma categoria em uma
   operação, sem alterar registros fora da minha autorização.
3. Como usuário, quero importar vários extratos com limites seguros e saber o
   resultado de cada arquivo.
4. Como operador, quero que falhas da API sejam distinguíveis de um mês sem
   movimentação.

## Evidência RED → GREEN

| Comportamento | RED observado | GREEN observado |
|---|---|---|
| Período mensal determinístico | `Cannot find module './report-period'` | 4 testes passaram |
| Contrato de categorização em massa | schema inexistente; 2 testes falharam | 3 testes passaram |
| Limites da importação em lote | `Cannot find module './import-limits'` | 3 testes passaram |

Comando GREEN final:

```text
pnpm --filter @finances/api test
Test Files  3 passed (3)
Tests       10 passed (10)
```

## Especificação das garantias

| # | Garantia | Teste | Tipo | Resultado |
|---|---|---|---|---|
| 1 | Julho/2026 começa em `2026-07-01T03:00:00Z` no relatório | `report-period.test.ts` | unitário | PASS |
| 2 | Dezembro avança corretamente para janeiro do próximo ano | `report-period.test.ts` | unitário | PASS |
| 3 | Ano/mês inválido é rejeitado | `report-period.test.ts` | unitário | PASS |
| 4 | Lote de categorização exige 1–100 IDs únicos | `bulk-categorize.test.ts` | schema | PASS |
| 5 | Upload aceita somente CSV/OFX, até 20 arquivos | `import-limits.test.ts` | unitário | PASS |
| 6 | Limites de 10 MB por arquivo e 50 MB por lote são aplicados | `import-limits.test.ts` | unitário | PASS |
| 7 | API compila com os contratos novos | `pnpm --filter @finances/api build` | compilação | PASS |
| 8 | Web compila e prerenderiza 24 páginas | `pnpm --filter @finances/web build` | compilação | PASS |
| 9 | API e web não possuem erros TypeScript | typecheck por pacote | estático | PASS |

## Verificação adicional

- A primeira compilação encontrou o defeito preexistente
  `Invalid base URL: /api/auth` durante o prerender.
- Após tornar a URL do Better Auth absoluta no servidor e same-origin no
  navegador, o build do Next 16.2.11 passou.
- O build raiz via Turbo pode atingir limite de path/symlink no Windows ao
  indexar `.next/standalone`; os builds diretos de API e web passaram.
- O lint não é executável na configuração atual:
  - web usa o comando removido `next lint`;
  - API não possui binário/configuração ESLint.

## Cobertura e lacunas

O repositório não possui configuração de cobertura nem testes de componente,
integração com banco ou Playwright. Portanto, não é possível afirmar 80% de
cobertura. Antes da promoção para produção ainda são necessários:

- teste de integração das autorizações da categorização em massa;
- teste multipart da importação em lote;
- E2E de login → overview, importação e categorização;
- smoke test real com Docker no servidor Linux.

