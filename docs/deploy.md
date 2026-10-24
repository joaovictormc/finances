# Plano de deploy: mobile, homologação e produção

## Contexto e decisões já tomadas

O desenvolvimento roda local (`pnpm dev`), conectando no Postgres e no Redis
da homologação pelo Tailscale. A homologação roda no servidor joaosrv
(Parte B); a produção vai para uma VPS com domínio (Parte C e
`docs/deploy-vps.html`).

Decisões tomadas antes de escrever este plano:

- **Homologação roda no servidor joaosrv** (Ubuntu Server), em Docker
  Compose, com Postgres e Redis próprios. Acesso só pela rede Tailscale (não
  precisa de domínio público nem certificado — é ambiente interno).
- **Produção roda numa VPS nova** (a provisionar) com **EasyPanel**, com
  **domínio próprio** (a registrar) apontando para ela.
- O banco de dados de **produção continua no ZimaOS** (mesma máquina que já
  hospeda hoje), acessado pela VPS via Tailscale — só o código (API + Web)
  muda de lugar. Mover o banco pra dentro da VPS é uma otimização futura,
  fora de escopo deste plano.
- Os workers do BullMQ (`apps/api/src/jobs/workers/*.worker.ts`) rodam
  **dentro do mesmo processo da API** (importados direto em
  `apps/api/src/index.ts`) — não existe um processo de worker separado hoje,
  então o deploy da API já cobre os workers automaticamente.

## Visão geral dos três ambientes

| Ambiente | Código | Banco | Acesso |
|---|---|---|---|
| **Dev** | Máquina local (`pnpm dev`) | Postgres/Redis da homologação (Tailscale) | `localhost` |
| **Homologação** | Docker Compose no joaosrv | Postgres/Redis no mesmo compose | Só via Tailscale (`100.84.104.128`) |
| **Produção** | Containers Docker na VPS (EasyPanel) | Postgres/Redis no ZimaOS (banco de produção) | Domínio público (HTTPS) |

Branches: `develop` = homologação, `main` = produção. Toda feature nova vai
para a `develop`, é testada na homologação e só depois vai para a `main`
(que dispara o deploy de produção no EasyPanel).

---

## Parte A — Compilar o mobile pra testar performance no dia a dia

O app hoje só roda via Expo Go (`pnpm --filter @finances/mobile dev`), que
tem overhead do próprio Expo Go e não reflete a performance real de um
build standalone. Pra testar de verdade no dia a dia, precisa de um build
instalável (APK no Android / build ad-hoc no iOS) via **EAS Build** (serviço
gratuito da Expo pro tier usado aqui — só builds na nuvem deles, sem custo
de infra própria).

### A.1 — Pré-requisitos (uma vez só)

```bash
npm install -g eas-cli
eas login          # cria conta grátis em expo.dev se não tiver
```

No **Android**: não precisa de mais nada, EAS assina o APK automaticamente
com uma keystore gerada por eles.

No **iOS**: precisa de uma conta Apple Developer paga (US$99/ano) pra gerar
build instalável fora da App Store (mesmo em modo "ad-hoc"/interno). Se só
tiver Android por agora, pule essa parte — o plano abaixo funciona igual só
com Android.

### A.2 — Endereço da API em cada perfil (`apps/mobile/eas.json`)

O app não descobre o endereço da API sozinho: ele é **embutido no app no momento
do build**, a partir das variáveis `env` de cada perfil do `eas.json`. Mudou o
endereço? Precisa gerar um build novo.

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_API_URL": "http://IP_DA_HOMOLOGACAO:3011",
        "EXPO_PUBLIC_LANDING_URL": "http://IP_DA_HOMOLOGACAO:3012"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "env": {
        "EXPO_PUBLIC_API_URL": "http://IP_DA_HOMOLOGACAO:3011",
        "EXPO_PUBLIC_LANDING_URL": "http://IP_DA_HOMOLOGACAO:3012"
      }
    },
    "production": {
      "autoIncrement": true,
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.SEUDOMINIO.com.br",
        "EXPO_PUBLIC_LANDING_URL": "https://SEUDOMINIO.com.br"
      }
    }
  }
}
```

- `EXPO_PUBLIC_API_URL`: a API (`apps/mobile/lib/api-client.ts` e `auth-client.ts`).
- `EXPO_PUBLIC_LANDING_URL`: links de Termos e Privacidade na tela de cadastro.

**Regras do endereço da API** — errar qualquer uma faz o login falhar:

1. **Sem barra no final e sem `/api`**: `https://api.seudominio.com.br`. O app
   monta `${EXPO_PUBLIC_API_URL}/api/...`; com barra sobra `//api`.
2. **Igual ao `BETTER_AUTH_URL` da API**, letra por letra (protocolo, host e
   porta). O app nativo envia como `Origin` o próprio endereço da API, e o
   Better Auth só aceita origens da lista `trustedOrigins`, que já inclui o
   `BETTER_AUTH_URL`. Igual a ele, não precisa mexer em `LAN_ORIGINS`.
   Diferente (outro IP, outra porta), inclua a origem em `LAN_ORIGINS` na API.
3. **Produção com `https://`.** HTTP puro só funciona porque o `app.json`
   libera tráfego sem criptografia (`NSAllowsArbitraryLoads` no iOS,
   `usesCleartextTraffic` no Android) para a homologação por IP. Para publicar
   nas lojas, o ideal é tirar essa liberação quando a homologação também tiver HTTPS.

No dia a dia com Expo Go (`pnpm --filter @finances/mobile dev`), o endereço
vem do `apps/mobile/.env` (fora do Git; ver `apps/mobile/.env.example`). O
`eas build` não envia esse arquivo, e as variáveis do perfil têm prioridade.

### A.3 — Gerar o build

```bash
cd apps/mobile
eas build:configure          # só na primeira vez, confirma o projeto no EAS
eas build --platform android --profile preview
```

O comando devolve um link (e um QR code) pra baixar o `.apk` direto no
celular — não precisa de Play Store nem de instalar via USB. Builds do
free tier do EAS demoram uns 10-20 min (fila compartilhada); dá pra rodar
`eas build --profile preview --local` se quiser compilar na sua própria
máquina em vez de esperar a fila (exige Android Studio/SDK instalado).

### A.4 — Credenciais de push (uma vez por projeto)

O push do celular passa pelo **Expo Push Service**: a API guarda o
`ExponentPushToken[...]` de cada aparelho (tabela `push_tokens`) e manda o aviso
pra `exp.host`. Quem fala com Google e Apple é a Expo — a API **não** tem
credencial de push nenhuma, e não precisa ter.

O que precisa existir é a credencial do **build**, gerenciada pelo EAS:

```bash
# Android: cria/associa a chave FCM V1 do projeto
eas credentials --platform android

# iOS: chave APNs (exige conta paga do Apple Developer)
eas credentials --platform ios
```

Dois pontos que costumam morder:

- **Push não funciona no Expo Go** desde o SDK 53 no Android. Precisa de build
  de desenvolvimento (`expo-dev-client`, já é dependência) ou build de produção.
- **Emulador não recebe push.** O `registerPushToken()` desiste cedo quando
  `Device.isDevice` é falso, de propósito — teste em aparelho real.

Sem essas credenciais o app continua funcionando: a central de notificações
dentro do app é alimentada pela API e não depende de push.

### A.5 — Atualizar sem recompilar (EAS Update)

`expo-updates` já está configurado (`app.json` → `updates`), e `eas update`
publica JS/TSX novo para o app instalado sem passar pela loja.

Cada perfil do `eas.json` tem um `channel` (`development`, `preview`,
`production`): o app só recebe as atualizações publicadas no canal com que
foi compilado. Builds feitos antes de o canal existir não recebem nada; gere
um build novo.

**Cuidado com o endereço da API:** o `eas update` não lê o `env` do
`eas.json`. Ele empacota com as variáveis da sua máquina, ou seja, o
`apps/mobile/.env` (IP local). Publicar assim faz o app de produção passar a
chamar o seu computador. Sempre passe o endereço na linha de comando:

```bash
cd apps/mobile
EXPO_PUBLIC_API_URL="https://api.SEUDOMINIO.com.br" \
EXPO_PUBLIC_LANDING_URL="https://SEUDOMINIO.com.br" \
  eas update --channel production --message "descrição da mudança"
```

Para a homologação (canal `preview`) já existe um script com o endereço do
joaosrv:

```bash
cd apps/mobile
pnpm run update:preview --message "descrição da mudança"
```

---

## Parte B — Homologação no servidor joaosrv (Ubuntu Server + Docker Compose)

A homologação roda no servidor **joaosrv** (Ubuntu Server), num único
`docker-compose.staging.yml` com tudo o que o sistema precisa: Postgres e
Redis próprios, migrations automáticas, API, web e landing. Acesso pela rede
Tailscale, pelo IP do servidor (`100.84.104.128`).

### B.1 — O que sobe

| Serviço | Imagem / Dockerfile | Porta no servidor | Para |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | `5434` | banco da homologação |
| `redis` | `redis:7-alpine` | `6380` | filas, e-mails, rotinas e limites de uso |
| `migrate` | `apps/api/Dockerfile` | — | roda uma vez por `up`: migrations + categorias padrão |
| `api-staging` | `apps/api/Dockerfile` | `3011` | API e workers |
| `web-staging` | `apps/web/Dockerfile` | `3010` | app web |
| `landing-staging` | `apps/landing/Dockerfile` | `3012` | landing page |

As portas foram escolhidas para não colidir com o que já roda no joaosrv: o
container `postgres_server` (porta `5433`, que também guarda bancos de outros
projetos: **não pare nem remova**) e eventuais Postgres/Redis na `5432`/`6379`.
As portas `3011` e `3012` são as que o perfil `preview` do `apps/mobile/eas.json` usa.

Os dados ficam em volumes do Docker (`controlai-homolog_postgres_data` e
`controlai-homolog_redis_data`): sobrevivem a `down`, rebuild e reinício do
servidor. Só `docker compose down -v` apaga.

### B.2 — Preparar o servidor (uma vez)

```bash
ssh joaosrv@100.84.104.128

# Docker Engine + plugin compose (pule se `docker compose version` já responde)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER      # sair e entrar de novo no SSH para valer

# Tailscale (pule se `tailscale ip -4` já responde)
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# Código
git clone https://github.com/joaovictormc/finances.git /home/joaosrv/finances
cd /home/joaosrv/finances && git checkout develop
```

### B.3 — `.env.staging` (só no servidor, nunca commitado)

Na raiz do repositório no joaosrv. Gere as senhas e segredos com
`openssl rand -hex 24` (hexadecimal: entram em URLs de conexão sem precisar
de escape) e `openssl rand -base64 32` onde indicado.

```bash
# ── Banco e Redis do compose ─────────────────────────────────────────────────
# O compose monta DATABASE_URL e REDIS_URL a partir destes valores: não
# defina essas duas variáveis aqui.
POSTGRES_USER="controlai"
POSTGRES_PASSWORD="..."            # openssl rand -hex 24
POSTGRES_DB="controlai_homolog"
REDIS_PASSWORD="..."               # openssl rand -hex 24

# ── Endereços (IP Tailscale do joaosrv, sem barra no final) ──────────────────
BETTER_AUTH_URL="http://100.84.104.128:3011"
NEXT_PUBLIC_API_URL="http://100.84.104.128:3011"
NEXT_PUBLIC_APP_URL="http://100.84.104.128:3010"
LANDING_URL="http://100.84.104.128:3012"
NEXT_PUBLIC_LANDING_URL="http://100.84.104.128:3012"
# Outras origens de onde o web é aberto (ex.: IP da LAN), separadas por vírgula
LAN_ORIGINS="http://100.84.104.128:3010"

# ── Segredos ─────────────────────────────────────────────────────────────────
BETTER_AUTH_SECRET="..."           # openssl rand -base64 32
APP_ENCRYPTION_KEY="..."           # openssl rand -base64 32 (ver nota abaixo)
LANDING_REVALIDATE_SECRET="..."    # openssl rand -hex 32

# ── Comportamento de homologação ─────────────────────────────────────────────
AUTH_REQUIRE_EMAIL_VERIFICATION="false"
ADMIN_BOOTSTRAP="true"             # mantém sempre uma conta admin de teste
ADMIN_EMAIL="admin@controlai.local"
ADMIN_PASSWORD="..."

# ── Rascunhos automáticos de Novidades: homologação acompanha a develop ─────
CHANGELOG_BRANCH="develop"

# ── Opcionais (também podem ser cadastrados em /admin) ──────────────────────
BREVO_API_KEY=""
EMAIL_FROM_ADDRESS=""
GROQ_API_KEY=""
```

> **`APP_ENCRYPTION_KEY` é obrigatória.** Os segredos de meio de pagamento e
> as chaves de IA cadastradas no painel são gravados criptografados em
> repouso — AES-256-GCM, `packages/db/src/crypto.ts`. Gere uma chave por
> ambiente com `openssl rand -base64 32` e **nunca troque depois que houver
> segredo salvo**: sem ela o valor no banco é irrecuperável, e as telas do
> admin recusam salvar com `503` em vez de cair para texto puro. Migrar de
> servidor mantendo os dados exige copiar esse valor junto.

### B.4 — Subir

```bash
cd /home/joaosrv/finances
docker compose --env-file .env.staging -f docker-compose.staging.yml up -d --build
```

O `--env-file` é obrigatório **em todo comando** (`up`, `ps`, `logs`, `exec`,
`down`...), não só no `up`: o compose relê o arquivo inteiro a cada comando e
para com "required variable REDIS_PASSWORD is missing a value" sem ele. Para
não repetir, crie um atalho no servidor:

```bash
echo "alias dch='docker compose --env-file /home/joaosrv/finances/.env.staging -f /home/joaosrv/finances/docker-compose.staging.yml'" >> ~/.bashrc
source ~/.bashrc
dch ps
```

O que acontece, em ordem: Postgres e Redis sobem e ficam saudáveis →
`migrate` aplica as migrations pendentes e o seed das categorias → API sobe
(e cria o admin, com `ADMIN_BOOTSTRAP`) → web e landing.

Conferir:

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml ps            # tudo "running"; migrate "exited (0)"
docker compose --env-file .env.staging -f docker-compose.staging.yml logs migrate  # migrations aplicadas
curl http://100.84.104.128:3011/health                     # {"status":"ok",...}
```

Abrir `http://100.84.104.128:3010` (app) e `http://100.84.104.128:3012`
(landing) com o Tailscale ligado.

### B.5 — Migrations

Automáticas: o serviço `migrate` roda `prisma migrate deploy` a cada `up`.
Para rodar na mão (ex.: conferir antes de subir a versão nova):

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml run --rm migrate \
  pnpm --filter @finances/db exec prisma migrate status
```

Use sempre `migrate deploy` (aplica só o que já está versionado em
`packages/db/prisma/migrations/`), nunca `db push`. Se acusar drift (banco
com schema fora do histórico), compare sem aplicar nada:

```bash
DATABASE_URL="postgresql://controlai:SENHA@100.84.104.128:5434/controlai_homolog?schema=public" \
  pnpm --filter @finances/db exec prisma migrate diff \
  --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma
```

> **Nunca passe o banco da homologação (nem o de produção) como
> `--shadow-database-url`.** O Prisma apaga o banco de rascunho: foi assim que
> a homologação perdeu os dados em 17/10/2026.

### B.6 — Trazer os dados do banco antigo (opcional)

Até aqui a homologação usava o banco `finance` dentro do container
`postgres_server` (porta `5433`). Para levar os dados para o Postgres do
compose (com o compose já no ar, no joaosrv):

```bash
cd /home/joaosrv/finances
set -a; . ./.env.staging; set +a

# 1. Parar a API para nada gravar durante a cópia
docker compose --env-file .env.staging -f docker-compose.staging.yml stop api-staging

# 2. Copiar (dados + histórico de migrations) do banco antigo para o novo
docker exec postgres_server pg_dump -U postgres -Fc finance > /tmp/finance.dump
docker compose --env-file .env.staging -f docker-compose.staging.yml exec -T postgres \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner < /tmp/finance.dump

# 3. Subir de novo (o migrate aplica o que faltar)
docker compose --env-file .env.staging -f docker-compose.staging.yml up -d
```

Confira o usuário do `postgres_server` (`postgres` acima) antes de rodar. O
`postgres_server` continua no ar servindo os outros projetos; o banco
`finance` pode ser apagado depois que a homologação nova estiver validada.

### B.7 — Desenvolvimento local apontando para a homologação

No `.env` da raiz do seu Mac (com o Tailscale ligado):

```
DATABASE_URL="postgresql://controlai:POSTGRES_PASSWORD@100.84.104.128:5434/controlai_homolog?schema=public"
REDIS_URL="redis://:REDIS_PASSWORD@100.84.104.128:6380"
```

Sem o Tailscale ligado, a API local não alcança nem o banco nem o Redis e
todas as telas falham com erro 500.

### B.8 — Backup do banco

```bash
mkdir -p ~/backups
crontab -e
# todo dia às 3h, guarda 14 dias
0 3 * * * cd /home/joaosrv/finances && docker compose --env-file .env.staging -f docker-compose.staging.yml exec -T postgres pg_dump -U controlai -Fc controlai_homolog > ~/backups/homolog-$(date +\%F).dump && find ~/backups -name 'homolog-*.dump' -mtime +14 -delete
```

### B.9 — Fluxo de trabalho

1. Feature nova → commit na `develop` (ou branch a partir dela) e push.
2. No joaosrv: `git pull` e
   `docker compose --env-file .env.staging -f docker-compose.staging.yml up -d --build`.
3. Testar em `http://100.84.104.128:3010`.
4. Aprovado → merge da `develop` na `main` → produção (Parte C) via EasyPanel.

Comandos do dia a dia:

```bash
C="docker compose --env-file .env.staging -f docker-compose.staging.yml"
$C logs -f api-staging      # acompanhar a API
$C restart api-staging      # reiniciar só a API (variável nova no .env.staging)
$C down                     # parar tudo (os dados ficam nos volumes)
```

### B.10 — Desligar a homologação antiga

Se ainda estiver rodando o compose antigo (`docker-compose.selfhosted.yml`,
containers `finances-*`), pare-o depois que a nova estiver no ar, para liberar
memória e portas:

```bash
docker compose -f docker-compose.selfhosted.yml --profile local-db down
```

Sem `-v`, os volumes antigos ficam guardados caso precise de algo deles.

---

## Parte C — Produção: VPS + EasyPanel + domínio

### C.1 — Provisionar a VPS

Qualquer provedor serve; opções custo-baixo comuns: Hetzner, DigitalOcean,
Contabo, Vultr. Especificação mínima confortável pra API+Web+Postgres client
(sem o banco, que fica no ZimaOS): **2 vCPU / 4GB RAM**, Ubuntu 22.04/24.04.

```bash
# Na VPS, via SSH
curl -sSL https://get.easypanel.io | sh
```

Ao final, o instalador mostra a URL pra acessar o painel do EasyPanel
(`http://IP_DA_VPS:3000` por padrão) — acesse e crie o usuário admin.

### C.2 — Conectar a VPS na rede Tailscale (pra falar com o Postgres do ZimaOS)

```bash
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up
```

Autorize o novo nó no [painel do Tailscale](https://login.tailscale.com/admin/machines).
A partir daqui, a VPS consegue alcançar `100.104.200.37:5432` (Postgres) e
`:6379` (Redis) como se estivesse na mesma rede — mesma forma que sua
máquina de dev já acessa hoje.

> Se os containers da API não conseguirem alcançar o Tailscale IP (alguns
> setups de Docker isolam a rede do container do `tailscale0` do host):
> habilite `net.ipv4.ip_forward=1` no host (`sysctl -w
> net.ipv4.ip_forward=1`, e persista em `/etc/sysctl.conf`) — geralmente já
> vem habilitado quando o Docker é instalado, mas vale confirmar.

### C.3 — Dockerfiles do monorepo

Já criados em `apps/api/Dockerfile` e `apps/web/Dockerfile` (+ `.dockerignore`
na raiz), usando `turbo prune` pra copiar só o necessário de cada app (evita
levar o monorepo inteiro pra dentro da imagem). `apps/web/next.config.ts` já
tem `output: "standalone"` — necessário pro Next gerar o `server.js`
autocontido que o Dockerfile do web espera.

Como não há Docker disponível na máquina de dev (Windows sem Docker Desktop
neste setup), o primeiro build real acontece direto no ZimaOS/VPS via
`docker compose ... up -d --build` (Parte B.4 / C.4) — ajustes finos de
dependência nativa (ex: Prisma exigindo `openssl` na imagem, já incluído nos
Dockerfiles) aparecem no log do build nesse momento.

### C.4 — Criar os apps no EasyPanel

No painel do EasyPanel:

1. **Criar projeto** (ex: `controlai`).
2. **Adicionar serviço "App"** pra API:
   - Fonte: repositório Git (GitHub) — conectar a conta e apontar pra
     branch `main`.
   - Build: "Dockerfile", caminho `apps/api/Dockerfile`, contexto de build
     na raiz do repo (`.`).
   - Variáveis de ambiente: colar o `.env` de produção (mesmo conteúdo do
     `.env.staging` da Parte B, mas com `DATABASE_URL`/`REDIS_URL` do
     banco de **produção**, não do de homologação).
   - Porta interna: `3001`.
3. **Repetir pra Web**, `apps/web/Dockerfile`, porta interna `3000`.
4. Ativar **deploy automático** em cada push na branch `main` (o EasyPanel
   já oferece isso via webhook do GitHub, configurado na tela do serviço).

### C.5 — Domínio

1. Registrar o domínio (Registro.br pra `.com.br`, ou qualquer registrador
   pra `.com`/outros).
2. No DNS do domínio, criar os registros:
   - `A  @              → IP da VPS`   (ou `www`, como preferir pro site)
   - `A  api            → IP da VPS`
3. No EasyPanel, na aba "Domains" de cada serviço (web e api), adicionar o
   domínio correspondente (`seudominio.com.br` pro web, `api.seudominio.com.br`
   pra API) — o EasyPanel gera o certificado HTTPS (Let's Encrypt) automático
   assim que o DNS propagar (pode levar de minutos a algumas horas).
4. Atualizar as env vars dos serviços pra usar os domínios reais:
   `NEXT_PUBLIC_APP_URL=https://seudominio.com.br`,
   `NEXT_PUBLIC_API_URL=https://api.seudominio.com.br`,
   `BETTER_AUTH_URL=https://api.seudominio.com.br`.
5. **`API_INTERNAL_URL` no serviço `web`** — desde que o `web` passou a falar
   com a API por proxy same-origin (rewrites em `apps/web/next.config.ts`, ver
   D.2), essa variável precisa apontar pra um endereço que o serviço `web`
   consiga alcançar **de dentro da rede do EasyPanel** — normalmente o nome
   interno do serviço da API dentro do projeto EasyPanel (equivalente ao
   `http://api:3001` usado no self-hosted), não o domínio público. Confirme
   o nome/porta interna do serviço na aba do EasyPanel; sem isso configurado
   corretamente, o `web` sobe mas as chamadas de API ficam sem destino.
6. Atualizar `apps/mobile/eas.json` (perfil `preview`/`production`) com o
   mesmo domínio da API e gerar um novo build (Parte A).

### C.6 — Landing page (`apps/landing`)

Com a landing no ar, o domínio principal passa a ser dela e o app vai para
um subdomínio:

| Serviço | Domínio | Porta interna | Dockerfile |
|---|---|---|---|
| Landing | `seudominio.com.br` (e `www`) | `3002` | `apps/landing/Dockerfile` |
| Web (app) | `app.seudominio.com.br` | `3000` | `apps/web/Dockerfile` |
| API | `api.seudominio.com.br` | `3001` | `apps/api/Dockerfile` |

1. DNS: `A @`, `A www`, `A app` e `A api` apontando para o IP da VPS.
2. No EasyPanel, novo serviço "App" igual aos outros (branch `main`, contexto
   `.`), Dockerfile `apps/landing/Dockerfile`, porta interna `3002`.
3. **Build args** (entram no JavaScript do navegador, então mudar exige
   rebuild). No **web**: `NEXT_PUBLIC_LANDING_URL=https://seudominio.com.br`
   e `API_INTERNAL_URL` (C.5). Na **landing**:
   - `NEXT_PUBLIC_APP_URL=https://app.seudominio.com.br` (botões Criar conta/Entrar)
   - `NEXT_PUBLIC_API_URL=https://api.seudominio.com.br` (preços atualizados no navegador)
4. **Variáveis de ambiente da landing** (runtime):
   - `API_INTERNAL_URL` = endereço interno da API no EasyPanel (como no item 5 do C.5)
   - `LANDING_REVALIDATE_SECRET` = mesmo valor da API (`openssl rand -hex 32`)
5. **Variáveis novas na API**:
   - `LANDING_URL=https://seudominio.com.br` (CORS e aviso de publicação)
   - `LANDING_REVALIDATE_SECRET` = o mesmo da landing
   - `LANDING_PREVIEW_SECRET` (opcional; sem ele usa o `BETTER_AUTH_SECRET`)
6. **`NEXT_PUBLIC_LANDING_URL` no web** vai como build arg (item 3), não só
   como variável: é ela que monta os links de Termos e Privacidade do cadastro
   e os botões Pré-visualizar e Ver no site do editor.
7. Mudar no web e na API o endereço do app para o subdomínio:
   `NEXT_PUBLIC_APP_URL=https://app.seudominio.com.br`. O `BETTER_AUTH_URL`
   continua sendo o da API.

O build da imagem não alcança a API, então as páginas saem com o conteúdo de
fábrica. Assim que o container sobe, `apps/landing/instrumentation.ts` pede a
revalidação de todas as páginas (por isso o `LANDING_REVALIDATE_SECRET` é
obrigatório na landing) e o primeiro visitante já recebe o conteúdo publicado
no admin.

Conferir: abrir o domínio, ver os preços carregados na seção de planos e, no
admin, publicar uma alteração e confirmar que aparece no site sem esperar.

---

## Parte D — Alternativa self-hosted em LAN (ZimaOS ou servidor Linux)

> **Referência antiga.** A homologação atual é a da Parte B
> (`docker-compose.staging.yml` no joaosrv, com Postgres e Redis próprios).
> Esta parte descreve o `docker-compose.selfhosted.yml`, que aponta para um
> Postgres/Redis externo; fica como alternativa.

Caminho **paralelo** à Parte C (VPS + EasyPanel + domínio), pra quem quer só
rodar API+Web em rede local, sem VPS nem domínio público. Usa um único
arquivo de compose (`docker-compose.selfhosted.yml`) que sobe tanto no
próprio ZimaOS (`192.168.1.2`) quanto num servidor Linux separado na mesma
LAN (`192.168.1.4`) — o servidor Linux é um plano B caso rodar direto no
ZimaOS dê erro (recurso, compatibilidade, etc.), não é obrigatório. Acesso
externo (fora da LAN) continua sendo via Tailscale, como já configurado
hoje — este compose não expõe nada além da rede local.

> **IP da LAN pode não bastar mesmo com os dois hosts no mesmo `/24`.**
> `192.168.1.2` e `192.168.1.4` podem estar em VLANs diferentes ou atrás de
> firewall entre segmentos — `nc -zv 192.168.1.2 5432` retornando
> `No route to host` é justamente isso (visto em teste real: preflight do
> D.1 falhou no servidor Linux). Nesse caso vá direto pro **modo fallback
> (D.4)** — não adianta tentar outras portas ou IPs da mesma faixa. Se
> quiser acesso externo (fora da LAN) ao ambiente rodando no servidor
> Linux nesse cenário, use o **IP Tailscale do próprio servidor Linux**,
> não o do ZimaOS (`100.104.200.37`) — são nós diferentes na malha
> Tailscale, cada um com seu IP. Descubra o do servidor Linux com
> `tailscale ip -4` (instale com
> `curl -fsSL https://tailscale.com/install.sh | sh && tailscale up` se
> ainda não estiver na malha).

### D.1 — Preflight de conectividade (só necessário se for rodar no servidor Linux)

Antes de decidir entre o modo normal e o modo fallback, confirme que o
servidor Linux (`192.168.1.4`) alcança o Postgres e o Redis do ZimaOS:

```bash
nc -zv 192.168.1.2 5432   # Postgres
nc -zv 192.168.1.2 6379   # Redis
```

Se as duas portas responderem, siga com o **modo normal** (D.3). Se
qualquer uma falhar (firewall, VLAN isolando os hosts, etc.), use o
**modo fallback** (D.4).

### D.2 — `.env.selfhosted`

Copie `.env.selfhosted.example` (raiz do repo) para `.env.selfhosted` no
host onde for rodar, e preencha as credenciais reais — esse arquivo nunca
é commitado (já está no `.gitignore`). Inclui `APP_ENCRYPTION_KEY`, que é
obrigatória (ver a nota em B.3). Ajuste `NEXT_PUBLIC_APP_URL`,
`API_URL`, `NEXT_PUBLIC_API_URL` e `BETTER_AUTH_URL` pro IP do host que vai
rodar os containers (`192.168.1.2` ou `192.168.1.4` pra acesso só na LAN;
o IP Tailscale do próprio host — `tailscale ip -4`, diferente do IP
Tailscale do ZimaOS — se quiser acessar de fora da LAN também).

> **O `web` fala com a API por um proxy same-origin** (rewrites em
> `apps/web/next.config.ts`, que encaminham `/api/*` pro serviço `api` via
> rede Docker interna, `API_INTERNAL_URL="http://api:3001"`) — o navegador
> nunca vê a URL real da API, só chama o mesmo host:porta de onde carregou a
> página. Isso significa que **o `web` funciona simultaneamente por LAN e
> por Tailscale sem precisar rebuild** quando o endereço de acesso muda.
>
> Ainda assim, `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_URL` (e `LAN_ORIGINS`)
> continuam importantes: a API (`apps/api/src/index.ts` e
> `apps/api/src/lib/auth.ts`) as lê em **runtime** pra montar a allowlist de
> CORS/`trustedOrigins`, e rejeita qualquer requisição cujo header `Origin`
> não esteja nessa lista — mesmo vindo pelo proxy do `web`. **Adicione em
> `LAN_ORIGINS` TODO endereço (protocolo+host+porta do `web`, não da API)
> pelo qual o app for acessado além do principal** — por exemplo, se acessar
> tanto pela LAN quanto pelo Tailscale, `LAN_ORIGINS` precisa ter a origem
> Tailscale do `web` (porta 3000), senão o login falha só quando acessado
> por lá, com uma mensagem de erro que pode nem citar CORS diretamente
> (a rejeição acontece dentro do Better Auth, não no navegador).

### D.3 — Portas: host x container

`API_PORT`/`WEB_PORT` no `.env.selfhosted` só controlam a porta **do lado
do host** (útil se 3000/3001 já estiverem ocupados por outra coisa na
máquina) — o compose sempre mapeia como `"${WEB_PORT}:3000"` e
`"${API_PORT}:3001"` (host:container). A porta **dentro** do container é
fixa (3000 pro Next.js, 3001 pra API) porque é onde as apps realmente
escutam — isolada por namespace de rede do Docker, nunca conflita com nada
do host. **Não** mude o lado direito do mapeamento nem tente "casar" as
duas portas — se o lado direito não for 3000/3001, o Docker encaminha pra
uma porta onde nada está escutando e a conexão cai com `ERR_CONNECTION_REFUSED`.

### D.4 — Modo normal (banco acessível na LAN)

```bash
docker compose -f docker-compose.selfhosted.yml up -d --build
```

Sobe só `api` e `web`, apontando pro Postgres/Redis do ZimaOS via
`DATABASE_URL`/`REDIS_URL` do `.env.selfhosted` (Cenário A do template).

### D.5 — Modo fallback (banco provisório, só para teste)

Se o preflight (D.1) falhar, troque `DATABASE_URL`/`REDIS_URL` no
`.env.selfhosted` pro Cenário B (apontando pro serviço `postgres`/`redis`
local — ver comentários no template) e suba com o profile `local-db`:

```bash
# 1. Sobe o banco primeiro e espera ficar saudável
docker compose -f docker-compose.selfhosted.yml --profile local-db up -d postgres redis
docker compose -f docker-compose.selfhosted.yml ps   # confirmar "healthy"

# 2. Aplica o schema no banco provisório (rodando via um container
#    descartável da própria imagem da api, já buildada — o host Linux "puro"
#    não tem pnpm instalado, só Docker)
docker compose -f docker-compose.selfhosted.yml --profile local-db run --rm --no-deps api \
  sh -c 'pnpm --filter @finances/db exec prisma migrate deploy'

# 3. Sobe api e web
docker compose -f docker-compose.selfhosted.yml --profile local-db up -d --build api web
```

**Sempre use `-f docker-compose.selfhosted.yml` em todo comando `docker
compose`** neste fluxo — rodar `docker compose up -d` sem o `-f` sobe o
`docker-compose.yml` de desenvolvimento (projeto Compose diferente, rede
Docker isolada) e a API não vai conseguir resolver `postgres`/`redis` por
nome (erro `getaddrinfo ENOTFOUND`), mesmo com os containers do banco
rodando e saudáveis.

Esse Postgres/Redis local são **provisórios e para testes** — servem pra
validar que a stack builda e sobe corretamente, não substituem o banco de
produção do ZimaOS a longo prazo.

### D.6 — Rebuild depois de mudar `.env.selfhosted`

Desde que o `web` passou a falar com a API por proxy same-origin
(`apps/web/next.config.ts`, ver callout no D.2), as variáveis de URL
públicas (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL`, `BETTER_AUTH_URL`,
`API_URL`, `LAN_ORIGINS`) não são mais embutidas no bundle JS do `web` —
são lidas em runtime pela API, então basta recriar o container, sem
rebuild:

```bash
docker compose -f docker-compose.selfhosted.yml --profile local-db up -d --force-recreate api web
```

**Exceção: `API_INTERNAL_URL`.** O Next.js resolve o destino de
`rewrites()` **durante o `next build`**, não em runtime — mudar essa
variável só no `.env.selfhosted`/`environment:` do container **não tem
efeito**, o proxy continua usando o valor que estava presente no momento do
build (`apps/web/Dockerfile`, `ARG API_INTERNAL_URL`, default já correto
`http://api:3001` pro nome do serviço neste compose). Só precisa rebuild
se for mudar esse valor pra algo diferente do default; no
`docker-compose.selfhosted.yml`/`docker-compose.yml` normal não precisa
mexer nele.

Rebuild (`--build`/`--no-cache`) é necessário se o **código** mudou (novo
commit) ou se `API_INTERNAL_URL` precisar de um valor diferente do
default — não quando só uma das outras variáveis de `.env.selfhosted`
muda.

### D.7 — Requisitos no host

Confirme que o Docker Compose instalado suporta `profiles` (Compose V2,
`docker compose version` ≥ 2.x) — tanto ZimaOS quanto uma instalação padrão
de Docker Engine em Ubuntu/Debian já atendem isso.

### D.8 — Landing page

O serviço `landing` (porta `3002`) usa o mesmo `.env.selfhosted`. Preencha as
variáveis `LANDING_*` e `NEXT_PUBLIC_LANDING_URL` (ver
`.env.selfhosted.example`). Diferente do `web`, a landing embute
`NEXT_PUBLIC_APP_URL` e `NEXT_PUBLIC_API_URL` no build. Para o compose ler
esses valores do `.env.selfhosted` na hora do build, passe `--env-file`:

```bash
docker compose --env-file .env.selfhosted -f docker-compose.selfhosted.yml up -d --build landing
```

Mudou uma dessas duas URLs? Rebuild da landing. As demais variáveis valem
com `--force-recreate`. Homologação segue igual, com `--env-file .env.staging`
e o serviço `landing-staging` na porta `3012`.

---

## Parte E — Alternativas gratuitas para testar antes de produção

Caso o self-hosted (Parte D) não seja viável (ex: sem acesso físico
constante ao servidor Linux, muitos erros de rede/Docker), dá pra validar
API+Web em serviços gratuitos antes de decidir sobre produção definitiva:

| Componente | Serviço sugerido | Observação |
|---|---|---|
| **Web** (Next.js standalone) | [Vercel](https://vercel.com) | Free tier, zero-config pra Next.js — é o próprio criador do framework. |
| **API** (Node + Prisma) | [Railway](https://railway.app) ou [Render](https://render.com) | Railway tem créditos grátis por período de teste; Render tem free tier permanente mas o serviço "dorme" após ~15 min de inatividade (primeira requisição fica lenta). |
| **Postgres** | [Neon](https://neon.tech) ou [Supabase](https://supabase.com) | Free tier em ambos. **Sem extensão TimescaleDB** — o código já tolera isso (`transactions` funciona como Postgres puro, ver `docs/setup.md`). |
| **Redis** | [Upstash](https://upstash.com) | Free tier serverless. Validar compatibilidade com os workers BullMQ (`apps/api/src/jobs/workers`) — comandos bloqueantes podem se comportar diferente num Redis serverless; testar a fila de verdade antes de confiar 100%. |

Fluxo sugerido: suba Postgres (Neon/Supabase) e Redis (Upstash) primeiro,
rode `prisma migrate deploy` contra eles, depois aponte a API (Railway/Render) e o
Web (Vercel) pras URLs desses serviços via variáveis de ambiente — mesmo
`.env` do `.env.selfhosted.example`, só trocando os valores de
`DATABASE_URL`/`REDIS_URL`/`NEXT_PUBLIC_API_URL` etc. Isso valida se a
aplicação builda e roda em produção antes de decidir sobre infra própria.

---

## Ordem de execução recomendada

1. **Parte B** (homologação no joaosrv) — não depende de VPS/domínio, dá pra
   fazer já e validar o fluxo de deploy via Docker num ambiente de baixo
   risco.
2. **Parte C.1-C.2** (VPS + EasyPanel + Tailscale) — provisionamento.
3. **Parte C.3** (Dockerfiles) — testar build local antes de subir.
4. **Parte C.4** (apps no EasyPanel apontando pra `main`).
5. **Parte C.5** (domínio) — depende do DNS propagar, pode ficar rodando em
   paralelo com o resto via IP da VPS enquanto isso.
6. **Parte A** (build mobile) — fica melhor por último, depois que a API de
   produção já estiver com domínio real, pra gerar o APK já apontando pro
   endereço definitivo.

## Publicar uma versão com migrations novas

A ordem importa: **banco primeiro, código depois.** O código novo consulta
tabelas e colunas que só existem depois da migration; o código antigo convive
bem com o banco já migrado, desde que as migrations só acrescentem (tabela,
coluna com valor padrão, índice). Antes de rodar, confira:

```bash
# Nada de DROP/RENAME nas migrations pendentes
grep -inE "drop|rename" packages/db/prisma/migrations/<pendentes>/migration.sql
```

1. **Homologação:** `migrate status` para ver o que falta e `migrate deploy`
   para aplicar (B.5: na homologação o serviço `migrate` faz isso a cada `up`).
   Subir os containers de homologação e testar.
2. **Produção:** os mesmos dois comandos com o `DATABASE_URL` de produção.
   Faça um backup antes (`pg_dump -Fc`).
3. Merge na `main`: o EasyPanel publica a API, o web e a landing.
4. Variáveis e painéis externos novos da versão (lista abaixo).

### Versão de outubro/2026 (assinatura, landing e promoções)

Migrations novas, todas só acrescentam:

| Migration | O que cria |
|---|---|
| `20261013120000_performance_indexes` | índices nos filtros mais usados |
| `20261014120000_daily_checkin` | colunas do check-in diário (gamificação) |
| `20261015120000_landing_pages` | páginas editáveis da landing |
| `20261015180000_landing_menu` | menu editável da landing |
| `20261016120000_promotions` | cupons, usos de cupom, regras de indicação |

Fora do código:

- **Mercado Pago:** em Suas integrações → Webhooks, deixar marcados os dois
  eventos de assinatura: o da assinatura em si (`subscription_preapproval`) e
  o da cobrança recorrente (`subscription_authorized_payment`, *Pagamentos de
  assinatura*). Sem o segundo, as renovações mensais não chegam e quem
  continua pagando perde o plano no primeiro vencimento
  (`docs/integrations.md`).
- **Landing:** novo serviço e variáveis da C.6.
- **Brevo:** os lembretes de conta, Pix e meta usam o mesmo remetente dos
  e-mails atuais. Nada novo a configurar.

## Verificação

- Homologação: `curl http://100.84.104.128:3011/health` deve responder
  `{"status":"ok"}`; abrir `100.84.104.128:3010` no navegador (com Tailscale
  ativo) deve carregar a tela de login.
- Produção: `curl https://api.seudominio.com.br/health` e abrir
  `https://seudominio.com.br` no navegador, confirmar certificado HTTPS
  válido.
- Mobile: instalar o APK gerado pelo perfil `preview`, criar uma conta,
  confirmar que as chamadas de rede vão pro domínio de produção (não pro
  `localhost`).
