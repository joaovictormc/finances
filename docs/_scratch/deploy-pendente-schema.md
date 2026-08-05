# Deploy pendente — sincronizar schema + subir containers

Contexto: código já commitado (`2e9bb1d`), enviado pro `origin/develop`,
já puxado no servidor (`/home/joaosrv/finances`) e as imagens `api`/`web`
JÁ FORAM REBUILDADAS com sucesso. Falta só sincronizar o schema do banco
(novo campo `categorySuggestionEnabled` em `AiSettings` + categoria
"Pagamento de Fatura de Cartão" no seed) e recriar os containers.

Rodar via SSH no servidor (Tailscale `100.84.104.128`, usuário `joaosrv`),
dentro de `/home/joaosrv/finances`:

```bash
# 1. Sincroniza o schema Prisma no Postgres (adiciona a coluna nova)
sudo docker compose -f docker-compose.selfhosted.yml --profile local-db \
  run --rm api pnpm --filter @finances/db exec prisma db push

# 2. Roda o seed de novo (cria a categoria "Pagamento de Fatura de Cartão")
sudo docker compose -f docker-compose.selfhosted.yml --profile local-db \
  run --rm api pnpm --filter @finances/db db:seed

# 3. Recria api + web com as imagens já buildadas
sudo docker compose -f docker-compose.selfhosted.yml --profile local-db \
  up -d --force-recreate api web

# 4. Confere que subiu ok
sudo docker compose -f docker-compose.selfhosted.yml ps
sudo docker logs finances-api-1 --tail 30
```

Depois disso, testar no navegador (`http://100.84.104.128:3010`):
- Login continua funcionando
- `/transactions`: importar um extrato, selecionar transações sem
  categoria, clicar "Sugerir categoria (IA)"
- Importar um extrato com uma linha de "pagamento de fatura de cartão" e
  confirmar que ela aparece como transferência (não como despesa)
- Navegar entre as rotas do dashboard e confirmar que aparece um spinner
  em vez de tela em branco

Se algo der erro no passo 1 (`prisma db push`), rodar antes:
```bash
sudo docker compose -f docker-compose.selfhosted.yml --profile local-db up -d postgres redis
```
(garante que o Postgres/Redis locais estão de pé antes do push).
