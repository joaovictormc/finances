# Plano de deploy: mobile, homologação e produção

## Contexto e decisões já tomadas

Hoje (`docs/setup.md`) só existe o fluxo de desenvolvimento: tudo roda local
(`pnpm dev`), conectando no PostgreSQL/Redis que já vivem no ZimaOS via
Tailscale (`100.104.200.37`). Não existe nenhum ambiente publicado — nem
homologação, nem produção — e o mobile só foi testado via Expo Go.

Decisões tomadas antes de escrever este plano:

- **Homologação roda no ZimaOS local**, com banco de dados separado do de
  produção. Acesso só pela rede Tailscale (não precisa de domínio público
  nem certificado — é ambiente interno).
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
| **Dev** (hoje) | Máquina local (`pnpm dev`) | Postgres/Redis no ZimaOS (Tailscale) | `localhost` |
| **Homologação** | Containers Docker no ZimaOS | Postgres/Redis no ZimaOS (banco separado) | Só via Tailscale |
| **Produção** | Containers Docker na VPS (EasyPanel) | Postgres/Redis no ZimaOS (banco de produção) | Domínio público (HTTPS) |

Branch sugerida: `main` = produção, `staging` = homologação. Toda feature
nova vai pra `staging` primeiro, é testada em homologação, e só depois vira
PR/merge pra `main` (que dispara o deploy de produção no EasyPanel).

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

### A.2 — Criar `apps/mobile/eas.json`

```json
{
  "cli": {
    "version": ">= 12.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": { "EXPO_PUBLIC_API_URL": "http://SEU_IP_LOCAL:3001" }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "env": { "EXPO_PUBLIC_API_URL": "https://api.SEUDOMINIO.com.br" }
    },
    "production": {
      "autoIncrement": true,
      "env": { "EXPO_PUBLIC_API_URL": "https://api.SEUDOMINIO.com.br" }
    }
  }
}
```

- `development`: dev client conectado no Metro da sua máquina (substitui o
  Expo Go quando precisar de um módulo nativo que o Expo Go não tem).
- **`preview`**: é o perfil pro seu uso diário — gera um APK que já aponta
  pra API de produção real (depois que a Parte C estiver no ar). Instala no
  celular e usa normalmente pra sentir a performance de verdade.
- `production`: reservado pra quando for publicar na Play Store/App Store
  (mesmo `EXPO_PUBLIC_API_URL`, mas com `autoIncrement` de versão).

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

### A.4 — Atualizar sem recompilar (opcional, EAS Update)

Se quiser aplicar ajustes de JS/TSX sem gerar um novo APK a cada vez,
`expo-updates` + `eas update` publica a atualização OTA pro app já
instalado. Fica de fora deste plano inicial — só vale configurar se o ciclo
de testar-ajustar-recompilar via EAS Build ficar lento demais na prática.

---

## Parte B — Homologação no ZimaOS

### B.1 — Banco de dados de homologação

Mais simples: um banco novo **no mesmo Postgres** que já roda no ZimaOS (não
precisa de um segundo container Postgres).

```bash
ssh usuario@100.104.200.37
docker exec -it finances_postgres psql -U finances -c "CREATE DATABASE finances_staging;"
```

Redis: usar o mesmo container, mas outro índice lógico (Redis tem 16 bancos
por padrão) — não precisa instalar nada novo, só trocar a URL:

```
# Produção/dev:    redis://100.104.200.37:6379
# Homologação:      redis://100.104.200.37:6379/1
```

### B.2 — Rodar a migration no banco de homologação

O Prisma CLI **não** carrega o `.env` da raiz do monorepo automaticamente —
só a API faz isso na mão (`process.loadEnvFile` em `apps/api/src/env.ts`).
Rodando `prisma db push` direto, é preciso definir `DATABASE_URL` na sessão
do shell antes do comando.

No PowerShell (Windows, shell padrão deste projeto):

```powershell
$env:DATABASE_URL = "postgresql://finances:SENHA@100.104.200.37:5432/finances_staging?schema=public"
pnpm --filter @finances/db exec prisma db push
```

No bash/zsh (ex.: rodando direto no ZimaOS via SSH):

```bash
DATABASE_URL="postgresql://finances:SENHA@100.104.200.37:5432/finances_staging?schema=public" \
  pnpm --filter @finances/db exec prisma db push
```

(Este projeto não usa `prisma migrate` — ver nota em `docs/setup.md` sobre
schema ser aplicado direto. `db push` sincroniza o schema atual sem gerar
histórico de migration, o que é aceitável pra homologação.)

### B.3 — `.env.staging` (fica só no ZimaOS, nunca commitado)

Copiar `.env.example` pra `.env.staging` e ajustar:

```
DATABASE_URL="postgresql://finances:SENHA@100.104.200.37:5432/finances_staging?schema=public"
REDIS_URL="redis://100.104.200.37:6379/1"
BETTER_AUTH_URL="http://100.104.200.37:3011"      # porta dedicada pra API de staging
NEXT_PUBLIC_API_URL="http://100.104.200.37:3011"
NEXT_PUBLIC_APP_URL="http://100.104.200.37:3010"  # porta dedicada pro web de staging
AUTH_REQUIRE_EMAIL_VERIFICATION="false"
ADMIN_BOOTSTRAP="true"                             # útil pra sempre ter uma conta de teste
```

Ideia das portas: produção/dev usam 3000/3001; homologação usa 3010/3011 —
só uma convenção pra não colidir se algum dia rodar os dois ao mesmo tempo
na mesma rede.

### B.4 — `docker-compose.staging.yml` (na raiz do repo, ou direto no ZimaOS)

```yaml
services:
  api-staging:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    env_file: .env.staging
    ports:
      - "3011:3001"
    restart: unless-stopped

  web-staging:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    env_file: .env.staging
    ports:
      - "3010:3000"
    restart: unless-stopped
```

(Os `Dockerfile`s referenciados aqui são os mesmos da Parte C — ver C.2.
Não precisa duplicar nada, o mesmo Dockerfile serve pra homologação e
produção; o que muda é só o `.env`.)

```bash
# No ZimaOS, dentro de uma cópia do repo (git clone/pull da branch `staging`)
docker compose -f docker-compose.staging.yml up -d --build
```

Depois disso, homologação fica acessível em `http://100.104.200.37:3010`
(web) e `:3011` (API) — só pra quem estiver na rede Tailscale.

### B.5 — Fluxo de trabalho

1. Nova feature → branch a partir de `staging`.
2. Merge na `staging` → `git pull` no ZimaOS → `docker compose -f
   docker-compose.staging.yml up -d --build` → testar em
   `100.104.200.37:3010`.
3. Aprovado → PR de `staging` pra `main` → deploy de produção (Parte C)
   acontece automaticamente via EasyPanel.

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

---

## Parte D — Alternativa self-hosted em LAN (ZimaOS ou servidor Linux)

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
é commitado (já está no `.gitignore`). Ajuste `NEXT_PUBLIC_APP_URL`,
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
  sh -c 'pnpm --filter @finances/db exec prisma db push'

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
(`apps/web/next.config.ts`, ver callout no D.2), **nenhuma variável de URL
no `.env.selfhosted` é mais embutida no bundle JS do `web`** — todas são
lidas em runtime, então basta recriar o container, sem rebuild:

```bash
docker compose -f docker-compose.selfhosted.yml --profile local-db up -d --force-recreate api web
```

Rebuild (`--build`/`--no-cache`) só é necessário se o **código** mudou
(novo commit), não quando só uma variável de `.env.selfhosted` muda.

### D.7 — Requisitos no host

Confirme que o Docker Compose instalado suporta `profiles` (Compose V2,
`docker compose version` ≥ 2.x) — tanto ZimaOS quanto uma instalação padrão
de Docker Engine em Ubuntu/Debian já atendem isso.

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
rode `prisma db push` contra eles, depois aponte a API (Railway/Render) e o
Web (Vercel) pras URLs desses serviços via variáveis de ambiente — mesmo
`.env` do `.env.selfhosted.example`, só trocando os valores de
`DATABASE_URL`/`REDIS_URL`/`NEXT_PUBLIC_API_URL` etc. Isso valida se a
aplicação builda e roda em produção antes de decidir sobre infra própria.

---

## Ordem de execução recomendada

1. **Parte B** (homologação no ZimaOS) — não depende de VPS/domínio, dá pra
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

## Verificação

- Homologação: `curl http://100.104.200.37:3011/health` deve responder
  `{"status":"ok"}`; abrir `100.104.200.37:3010` no navegador (com Tailscale
  ativo) deve carregar a tela de login.
- Produção: `curl https://api.seudominio.com.br/health` e abrir
  `https://seudominio.com.br` no navegador, confirmar certificado HTTPS
  válido.
- Mobile: instalar o APK gerado pelo perfil `preview`, criar uma conta,
  confirmar que as chamadas de rede vão pro domínio de produção (não pro
  `localhost`).
