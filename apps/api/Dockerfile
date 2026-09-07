FROM node:20-slim AS base
# O corepack que vem no node:20-slim é bem mais antigo que o pnpm pedido em
# `packageManager` (10.34.5) e não conhece as chaves usadas pra assinar os
# lançamentos novos — a primeira chamada a `pnpm` falha com erro de integridade
# ("Cannot find matching keyid"). Atualizar o corepack antes de habilitá-lo
# mantém o `packageManager` como fonte única da versão.
# Sem isto o corepack pergunta "Do you want to continue? [Y/n]" antes de baixar o
# pnpm. Onde não há TTY — `db-init` no `up -d`, CI, qualquer automação — não há
# quem responda, e o comando morre.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN npm install -g corepack@latest && corepack enable
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune @finances/api --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
# `--ignore-scripts` é obrigatório aqui: `out/json/` traz só os package.json, sem
# o código. O postinstall de packages/db é `prisma generate`, que não encontra
# `prisma/schema.prisma` neste estágio, sai 1 e derruba o install inteiro.
# O schema só chega no estágio seguinte (out/full/), onde o generate é executado
# explicitamente. Mesma flag que o CI já usa (.github/workflows/ci.yml).
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM base AS builder
WORKDIR /app
COPY --from=installer /app .
COPY --from=pruner /app/out/full/ .
RUN pnpm --filter @finances/db exec prisma generate
RUN pnpm turbo run build --filter=@finances/api

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app .
EXPOSE 3001
CMD ["pnpm", "--filter", "@finances/api", "exec", "tsx", "dist/index.js"]
