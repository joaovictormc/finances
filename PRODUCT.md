# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

- `apps/web` — Next.js 16 (App Router) + Tailwind v4, painel principal.
- `apps/mobile` — Expo (SDK 57) / React Native, app iOS e Android.
- `apps/api` — Hono + Prisma (PostgreSQL), filas BullMQ/Redis.
- `apps/landing` — landing page de anúncio: Next.js 16 em exportação estática + Tailwind v4, mesma stack do web (escolha do usuário, 14/10/2026).

## Users

Famílias e casais brasileiros de classe média que gerenciam o dinheiro da casa
em conjunto. Lançam gastos no dia a dia pelo celular ou pela web e usam o
painel para ver o mês consolidado, acompanhar orçamentos e metas e decidir
juntos. Dentro de um grupo, cada pessoa tem um papel: dono, administrador,
membro ou visualizador.

## Product Purpose

Gestão financeira pessoal e familiar: transações, orçamentos, metas, contas a
pagar e contas bancárias, com importação de extrato e um assistente de IA. Sucesso é a família conseguir ver
e decidir sobre o dinheiro em conjunto sem fricção.

## Positioning

Gestão financeira **em grupo/família** como mecanismo central, não recurso
lateral: contas, transações, orçamentos e metas compartilhados entre membros
com papéis definidos, convite por link, painel agregado do grupo e aviso de
atividade. Concorrentes de orçamento pessoal (Mobills, Organizze, GuiaBolso)
tratam compartilhamento como funcionalidade extra; aqui é a espinha dorsal.

## Operating Context

- Web (`apps/web`): visão geral com KPIs e gráficos (clique na categoria
  detalha as transações), transações, contas, orçamentos, metas, contas a
  pagar, grupos, recompensas, configurações e área administrativa.
- App mobile (`apps/mobile`): mesmas áreas principais, leitura de cupom fiscal
  por foto e assistente de IA. **Ainda não publicado nas lojas.**
- Assistente de IA (Groq) com conversas e agentes personalizados; insights
  mensais e consultas em linguagem natural.
- Importação de extrato CSV/OFX com deduplicação.
- **Sem integração bancária automática.** Existe código da Pluggy atrás de
  feature flag (`NEXT_PUBLIC_ENABLE_PLUGGY`), desligado e fora do produto;
  Open Finance nunca é anunciado em interface, landing ou e-mail.
- Gamificação: pontos e níveis por registrar transações, sequência de dias,
  check-in diário com recompensa configurável, Roleta Semanal e emblemas.
- Categorias padrão hierárquicas mais categorias personalizadas do usuário.
- Avisos (sino no app, push no celular e e-mail opcional) que existem de fato:
  insight mensal, conta recorrente detectada, previsão de estouro de orçamento
  (para o grupo todo em orçamento de grupo), novo membro no grupo, recompensa
  de indicação, prêmio de dias de plano, lembrete de conta a pagar (3 dias
  antes e no dia), meta em 50/75/100% (todos os membros em meta de grupo),
  assinatura Pix vencendo (5 dias antes e no dia) e cobrança recusada no
  cartão. **Não existem** aviso por gasto lançado no grupo nem por saldo
  negativo — não anunciar.
- Cancelar a assinatura para a cobrança e mantém o plano até o fim do período
  já pago; o cancelamento feito pelo admin é imediato.
- Promoções (Admin › Promoções): cupons de desconto que valem para a
  assinatura inteira (cartão e Pix, mínimo R$ 1,00 por cobrança, um uso por
  pessoa) e recompensa de indicação configurável — regra padrão e campanhas
  com período; quem indica e já paga ganha dias no próprio plano, quem está no
  Free ganha dias de um plano, pontos ou nada, conforme a regra. Não há
  período de teste.
- Monetização por assinatura (Free/Pro/Família), mensal, semestral ou anual,
  paga por Mercado Pago ou Pix.

## Capabilities and Constraints

- Planos (features em `apps/api/src/lib/plans.ts`; preços no banco, editáveis
  em `/admin/pricing`):
  - **Free**: lançamento manual e importação de extrato, 3 meses de
    histórico, sem IA, sem leitura de cupom, sem grupo.
  - **Pro**: histórico ilimitado, insights e assistente de IA, leitura de
    cupom. Sem grupo.
  - **Família**: tudo do Pro + grupo familiar com até 5 membros.
- A landing lê os preços pela API pública de planos — nunca escrever valores
  fixos.
- Domínios da landing e do app ainda não definidos (`NEXT_PUBLIC_APP_URL` no
  deploy).
- Idioma: PT-BR em toda a interface e comunicação; moeda, data e categorias no
  formato brasileiro.

## Brand Commitments

- Nome do produto: **ControlAI** (web, app mobile, manifest, metadados).
- Logo: quadrado arredondado amarelo `#FFC300` com linha de gráfico em grafite
  `#1C1C1E` — `apps/web/public/icons/logo.svg`.
- Sistema visual do app: "Fechamento de Caixa" em `apps/web/DESIGN.md`. A
  identidade antiga (indigo, dark mode preto puro) é anti-referência.

## Evidence on Hand

- `docs/features.md`: mapa de funcionalidades por fase.
- `docs/landing/`: esboços aprovados da landing (direção C escolhida, com
  elementos de A e B).
- **Não existem** depoimentos, cases, números de clientes, avaliações de loja
  ou cobertura de imprensa — não inventar.
- App não publicado nas lojas: nenhum link de loja real.

## Product Principles

1. Compartilhamento em grupo é o mecanismo central — todo design deixa claro
   "de quem" é cada dado quando há vários membros.
2. Registrar tem que ser rápido e a visão consolidada tem que ser clara: são
   dois modos de uso complementares.
3. PT-BR e formatos brasileiros são regra, não exceção.
4. Simplicidade para quem é leigo em finanças; a IA fica disponível, mas não
   é pré-requisito.
5. Dinheiro real exige clareza e confiança visual acima de expressividade,
   principalmente em pagamento e área administrativa.

## Accessibility & Inclusion

WCAG AA como piso: produto financeiro usado por público amplo, incluindo
pessoas pouco familiarizadas com tecnologia.
