FROM node:20-slim AS base
# Mesmo preparo do pnpm de apps/web/Dockerfile: corepack atualizado (chaves de
# assinatura novas) e sem a pergunta interativa antes de baixar o pnpm.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN npm install -g corepack@latest && corepack enable

FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune @finances/landing --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
# A landing não usa o Prisma, mas o install de workspace segue a mesma regra do
# web/api: sem scripts, porque out/json/ ainda não tem o código.
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM base AS builder
WORKDIR /app
COPY --from=installer /app .
COPY --from=pruner /app/out/full/ .
# NEXT_PUBLIC_* entram no JavaScript do navegador durante o build (botões de
# cadastro/login e atualização dos preços): mudar o domínio exige rebuild.
# API_INTERNAL_URL, ao contrário, é lido em runtime pelo servidor da landing.
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# O build não alcança a API: as páginas saem com o conteúdo de fábrica e são
# trocadas pelo publicado logo que o servidor sobe (instrumentation.ts).
RUN pnpm turbo run build --filter=@finances/landing

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/landing/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/landing/.next/static ./apps/landing/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/landing/public ./apps/landing/public
USER nextjs
EXPOSE 3002
CMD ["node", "apps/landing/server.js"]
