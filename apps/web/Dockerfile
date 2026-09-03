FROM node:20-slim AS base
# O corepack que vem no node:20-slim é bem mais antigo que o pnpm pedido em
# `packageManager` (10.34.5) e não conhece as chaves usadas pra assinar os
# lançamentos novos — a primeira chamada a `pnpm` falha com erro de integridade
# ("Cannot find matching keyid"). Atualizar o corepack antes de habilitá-lo
# mantém o `packageManager` como fonte única da versão.
RUN npm install -g corepack@latest && corepack enable
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune @finances/web --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=installer /app .
COPY --from=pruner /app/out/full/ .
# Next.js resolve o destino de rewrites() (next.config.ts) durante o build,
# não em runtime — precisa estar disponível aqui, não só no container final.
# Default já correto pro docker-compose.selfhosted.yml/docker-compose.yml
# (nome do serviço "api" na rede Docker interna); outros ambientes (ex:
# EasyPanel, ver docs/deploy.md C.5) passam build.args com o valor certo.
ARG API_INTERNAL_URL=http://api:3001
ENV API_INTERNAL_URL=$API_INTERNAL_URL
RUN pnpm --filter @finances/db exec prisma generate
RUN pnpm turbo run build --filter=@finances/web

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
