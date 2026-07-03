# Segurança, design, IA de recorrência e configurações — roadmap pós-mobile

> Data: 2026-07-02 · Status: planejado (nenhuma fase implementada ainda)

## Contexto

Com as Fases 0-7 do mobile concluídas (paridade funcional com o web +
redesign visual "Finans" no mobile — ver
`docs/superpowers/specs/2026-06-27-mobile-roadmap-e-redesign-finans.md`),
abrimos um novo ciclo de trabalho em quatro frentes que ficaram pra trás:

1. **Segurança da autenticação** — política de senha forte, botão de
   mostrar/ocultar senha, MFA, rate limiting, hardening de sessão/cookie.
2. **Paridade visual** — as cores do web hoje divergem da paleta Finans
   adotada no mobile; existe também uma lista de pequenas inconsistências
   de design a resolver.
3. **Inteligência da detecção de recorrência** — hoje a IA marca qualquer
   despesa recorrente como "conta fixa", incluindo cartão de crédito/débito
   (que é variável mês a mês). O objetivo é restringir a Pix/boleto, que são
   os pagamentos realmente fixos (aluguel, mensalidades, assinaturas pagas
   por boleto etc.).
4. **Configurações incompletas** — o web tem seções que são só enfeite (sem
   backend por trás) e o mobile não expõe funcionalidades que a API já tem.

Este documento é o roadmap por fases pra seguir à risca — cada fase é
implementada numa conversa própria, do mesmo jeito que o roadmap mobile foi
seguido ("vamos seguir para a Fase X").

## Achados da auditoria (estado atual, antes de qualquer mudança)

**Segurança** (`apps/api/src/lib/auth.ts`):
- `minPasswordLength: 8`, sem regra de complexidade (maiúscula/número/
  símbolo), sem indicador de força em nenhuma tela.
- Nenhum campo de senha tem botão de mostrar/ocultar — web
  (`apps/web/app/(auth)/login/page.tsx:66-74`,
  `apps/web/app/(auth)/register/page.tsx:88-96`) e mobile
  (`apps/mobile/app/(auth)/login.tsx:65-73`,
  `apps/mobile/app/(auth)/register.tsx:72-80`) usam `type="password"` /
  `secureTextEntry` puro.
- Nenhum plugin de MFA habilitado (`twoFactor`/`passkey`/`magicLink` — zero
  ocorrências no código); o schema Prisma não tem campos de 2FA.
- Sem rate limiting configurado em `/api/auth/*` (nem middleware Hono
  dedicado nem bloco `rateLimit` do better-auth).
- Cookie/sessão usam só os defaults do better-auth — `secure`, `sameSite`,
  `httpOnly` e `expiresIn` não são setados explicitamente em
  `apps/api/src/lib/auth.ts`.
- CORS não é wildcard (lista explícita + `LAN_ORIGINS`); não há middleware
  de CSRF em lugar nenhum (mitigado parcialmente pelo `trustedOrigins` do
  better-auth).
- Rotas admin (`apps/api/src/routes/admin.ts`) protegidas corretamente
  (`requireAuth` + `requireAdmin`); nenhum secret vazando client-side.

**Design/cores** (mobile usa `apps/mobile/tailwind.config.js` +
`apps/mobile/lib/theme.tsx`; web usa Tailwind v4 `@theme` dentro de
`apps/web/app/globals.css`, sem `tailwind.config.js`/`.ts` separado):

| Token | Mobile (Finans) | Web (atual) |
|---|---|---|
| primary | `#FEDC33` (âmbar) | `oklch(0.585 0.222 264.5)` (azul saturado) |
| foreground | `#14142B` (navy) | `oklch(0.13 0 0)` (quase preto) |
| background / card / border / muted | — | já bem próximos do mobile, não precisam de ajuste grande |

O gap principal é a cor de marca (azul → âmbar) e o foreground (preto →
navy). O web também não tem opção de tema "sistema" (só light/dark binário
em `apps/web/app/providers/theme-provider.tsx`; o mobile tem os 3 via
`apps/mobile/lib/theme.tsx`). O mobile hardcoda cores de gráfico/income/
expense inline (`SLICE_COLORS` em `app/(tabs)/index.tsx`, `#22c55e`/
`#ef4444` espalhados) em vez de usar token — vale revisar quando mexer em
gráficos (Fase 4).

**Gráficos da Visão Geral** — mobile (`apps/mobile/app/(tabs)/index.tsx`) só
tem o donut de categorias do mês atual + lista de transações recentes, sem
navegação de mês. O web (`apps/web/app/(dashboard)/overview/page.tsx`) tem
também um **gráfico de barras dos últimos 6 meses** (receita x despesa, via
`recharts`), navegação de mês, preview de metas e preview de contas a
pagar. `react-native-gifted-charts` (já instalado no mobile, usado hoje só
pro `PieChart`) também tem `BarChart`/`LineChart` disponíveis e não usados.

**IA de recorrência** (`apps/api/src/lib/ai/recurring-detector.ts`) é 100%
determinística (sem chamada de LLM) — agrupa transações de despesa por nome
de estabelecimento normalizado (`normalizeMerchant`) e por intervalo de
dias entre ocorrências (semanal/mensal/anual). O único filtro no `where` é:

```ts
where: { userId, type: "expense", isIgnored: false, date: { gte: since } },
```

Não filtra por `paymentMethod` nem `source`. O schema do `Transaction`
(`packages/db/prisma/schema.prisma`) só tem `paymentMethod: "debit" |
"credit"` — não existe "pix"/"boleto" como valor formal em campo nenhum.

**Configurações** — no web, "Perfil" (editar nome/email) e "Notificações"
(`apps/web/app/(dashboard)/settings/page.tsx`) são só UI decorativa, sem
chamada de API. Rotas server-side sem UI equivalente em nenhuma
plataforma: vínculo do bot do Telegram (`apps/api/src/routes/bots/
telegram-link.ts` — web tem UI numa página separada `/bot`, fora de
Configurações; mobile não tem UI nenhuma), exclusão permanente de conta
(`DELETE /api/accounts/:id/permanent` já existe pra contas financeiras, mas
não há "excluir minha conta de usuário"), exportar/apagar dados pessoais
(LGPD — nem a rota existe ainda).

## Decisões já tomadas

- **Sinal de Pix/boleto**: ~~sem mudança de schema, via regex na
  `description`~~ — **superado antes da Fase 5**: o campo `paymentMethod`
  ganhou os valores `"pix"` e `"boleto"` (além de `debit`/`credit`) como
  parte de uma extensão pedida à parte (categorização manual de forma de
  pagamento em qualquer transação). A Fase 5 filtra direto por
  `paymentMethod: { in: ["pix", "boleto"] }`, mais confiável que regex na
  descrição.
- **MFA**: TOTP (app autenticador, tipo Google Authenticator/Authy) +
  códigos de backup, via plugin oficial `twoFactor` do better-auth. Sem
  SMS (evita contratar/pagar um provedor externo tipo Twilio).

## Parte A — Roadmap por fases

| Fase | Escopo | Complexidade |
|---|---|---|
| **1** | Cores do web → paleta Finans (só tokens em `globals.css`; mesma estratégia que o mobile usou na Fase 0 — token primeiro, telas internas herdam automaticamente pelas classes utilitárias) | Baixa |
| **2** | Botão mostrar/ocultar senha nos formulários de login/registro (web + mobile) | Baixa |
| **3** | Política de senha forte + indicador de força visual (schema compartilhado client+server) | Média |
| **4** | Gráfico de barras (6 meses, receita x despesa) + navegação de mês na Visão Geral do mobile, usando `BarChart` de `react-native-gifted-charts` | Média |
| **5** | IA de recorrência: filtrar candidatos por `paymentMethod: pix\|boleto`, excluindo cartão débito/crédito e dinheiro do agrupamento | Baixa |
| **6** | Configurações extras: Perfil real (`authClient.updateUser`), Notificações realmente persistidas (novo campo/tabela + rota), vínculo do bot do Telegram dentro da tela de Configurações do mobile | Média-Alta |
| **7** | Rate limiting em `/api/auth/*` + hardening explícito de cookie/sessão (`secure`/`sameSite`/`httpOnly`/`expiresIn`) | Média |
| **8** | MFA (TOTP + backup codes via plugin `twoFactor` do better-auth) — migration Prisma, enrollment com QR code, verificação no login em ambas plataformas | Alta |
| **9** | LGPD: exportar meus dados / excluir minha conta (rota nova + UI web e mobile) | Média |

Sequência recomendada: **1 → 2 → 3** (vitórias rápidas de UI/segurança) →
**4 → 5** (paridade de produto) → **6 → 7** (configurações + hardening) →
**8 → 9** (features maiores, ficam por último por serem as de maior
esforço/risco).

## Parte B — Achados de design a resolver (checklist, não uma reescrita geral)

- Web não tem opção de tema "sistema" (só light/dark) — mobile tem os 3;
  avaliar ao mexer no `theme-provider.tsx` do web (pode entrar junto da
  Fase 1 ou ficar solto).
- Mobile hardcoda cores de gráfico/income/expense inline em vez de token —
  revisar quando tocar em gráficos (Fase 4).
- Menu "Mais" do mobile é visualmente mais simples (lista `rounded-xl`) do
  que os cards do dashboard web — não bloqueante, é só um ajuste de polish
  pra uma fase futura.
- Radius scale: web usa `rounded-2xl` como teto pros cards; mobile usa
  `rounded-3xl` em alguns cards do Overview — vale unificar quando mexer
  nesses componentes, não precisa de fase própria.

Esses itens não geram fase dedicada — cada um é resolvido de carona na fase
que já for tocar no arquivo relevante (ex: tema "sistema" do web na Fase 1).

## Parte C — Detalhamento técnico por fase

**Fase 1 — Cores do web**: editar as variáveis `@theme` em
`apps/web/app/globals.css` (light e dark), trocando `primary`/
`primary-foreground`/`foreground` pelos equivalentes em OKLCH da paleta
Finans (âmbar `#FEDC33`, navy `#14142B`). Como Tailwind v4 usa CSS vars
direto, os componentes que já usam `bg-primary`/`text-foreground` herdam a
cor sem precisar editar cada tela. Aproveitar pra adicionar a opção
"sistema" no `theme-provider.tsx`, se coubrir no mesmo escopo.

**Fase 2 — Mostrar/ocultar senha**: web — adicionar toggle de tipo
(`password`/`text`) + ícone `Eye`/`EyeOff` (lucide-react, já usado no
projeto) no componente `apps/web/components/ui/input.tsx` ou diretamente
nas telas de login/registro. Mobile — `TextInput` com `secureTextEntry`
condicional + ícone `Ionicons` `eye-outline`/`eye-off-outline`, replicado
em `login.tsx` e `register.tsx`.

**Fase 3 — Senha forte**: criar schema compartilhado (ex:
`packages/validations/src/password.schema.ts`) com as regras de
complexidade, reusado no formulário de registro do web e do mobile e,
opcionalmente, num `PATCH` de troca de senha se a Fase 6/9 criar essa rota.
Indicador de força: barra simples calculada client-side a partir das
mesmas regras, sem lib externa.

**Fase 4 — Gráficos do Overview mobile**: em
`apps/mobile/app/(tabs)/index.tsx`, buscar os últimos 6 meses via
`GET /api/transactions/reports/monthly` (chamado em loop por mês, ou nova
rota agregada se fizer sentido) e renderizar com `BarChart` de
`react-native-gifted-charts`. Adicionar seletor de mês (setas
prev/next) reaproveitando o padrão de pílulas já usado em outras telas.

**Fase 5 — IA de recorrência**: em
`apps/api/src/lib/ai/recurring-detector.ts`, adicionar um filtro na query
de transações candidatas (ou um `.filter()` logo após o fetch) que só
mantém transações cuja `description` bate em `/\bpix\b/i` ou
`/\bboleto\b/i`. Documentar no código o porquê (heurística por texto, sem
campo formal no schema).

**Fase 6 — Configurações extras**: Perfil — trocar o `handleSaveProfile`
decorativo do web por uma chamada real a `authClient.updateUser({ name,
email })` (better-auth já suporta isso client-side) e portar a mesma tela
pro mobile em `apps/mobile/app/settings.tsx`. Notificações — criar
tabela/campo de preferências (ex: `NotificationPreferences` no
`schema.prisma` ou colunas no `User`) + rota `GET`/`PATCH` na API, e trocar
os toggles de `useState` local por estado persistido nos dois apps.
Telegram — reaproveitar `apps/web/components/bot/telegram-link.tsx` como
referência pra criar o equivalente mobile, chamando as rotas já existentes
em `apps/api/src/routes/bots/telegram-link.ts`.

**Fase 7 — Rate limiting + hardening de sessão**: habilitar o bloco
`rateLimit` do better-auth (ou middleware Hono dedicado) em
`apps/api/src/lib/auth.ts`/`apps/api/src/index.ts` mirando `/api/auth/*`.
Setar explicitamente `session.expiresIn`, `session.updateAge` e as opções
de cookie (`secure`, `sameSite`, `httpOnly`) em vez de depender dos
defaults implícitos do better-auth.

**Fase 8 — MFA**: habilitar o plugin `twoFactor()` do better-auth em
`apps/api/src/lib/auth.ts` (server) e no client (`apps/web/lib/auth-
client.ts`, `apps/mobile/lib/auth-client.ts`), rodar a migration Prisma que
o plugin gera (tabela/campos de segredo TOTP + backup codes), construir
tela de enrollment com QR code (web: lib de QR já usada em `billing/
page.tsx` via `react-qr-code`; mobile: teria que gerar o QR de outra forma,
já que não instalamos lib de QR no mobile — avaliar nessa fase) e tela de
verificação de código no fluxo de login em ambas plataformas.

**Fase 9 — LGPD**: nova rota `GET /api/user/export` (dump JSON dos dados do
usuário) e `DELETE /api/user` (exclusão de conta, com confirmação forte —
reautenticação ou digitar a senha), + UI em "Configurações" nos dois apps.

## Verificação

A cada fase: `pnpm --filter @finances/web typecheck`,
`pnpm --filter @finances/mobile typecheck` e
`pnpm --filter @finances/api typecheck` sem erros, mais uma nota de teste
manual específica da fase — por exemplo, Fase 1: abrir o web e comparar
visualmente com o mobile lado a lado; Fase 8: habilitar 2FA numa conta de
teste e validar o fluxo completo de login com código + backup code.

## Fora de escopo (deste passo)

Implementar qualquer uma das fases acima. Este documento é só o roadmap —
a implementação começa quando o usuário escolher por qual fase seguir
("vamos seguir para a Fase X"), do mesmo jeito que o roadmap mobile foi
conduzido.
