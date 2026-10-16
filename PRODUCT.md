# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Famílias e casais brasileiros de classe média que gerenciam finanças em
conjunto. Usam o produto no dia a dia tanto pelo bot do Telegram (registro
rápido de gastos por texto/voz) quanto pela web (visão consolidada,
relatórios, configuração de orçamentos/metas/contas). Perfis de acesso
dentro de um grupo: owner/admin/member/viewer.

## Product Purpose

Gestão financeira pessoal e familiar: controle de transações, orçamentos,
metas, contas a pagar e contas bancárias, com sincronização opcional via
Open Finance (Pluggy) e insights gerados por IA (Groq). Sucesso é a família
conseguir ver e decidir sobre o dinheiro em conjunto sem fricção — registro
rápido pelo bot, visão clara na web.

## Positioning

Gestão financeira **em grupo/família** como mecanismo central, não recurso
lateral: contas, transações, orçamentos e metas compartilhados entre
membros de um grupo com papéis definidos (owner/admin/member/viewer),
convite por link, dashboard agregado do grupo e notificações de atividade.
Concorrentes de orçamento pessoal (Mobills, Organizze, GuiaBolso) tratam
compartilhamento como funcionalidade extra; aqui é a espinha dorsal do
produto.

## Operating Context

- Web (Next.js/Tailwind v4) como painel principal: overview com KPIs e
  gráficos, transações, contas, orçamentos, metas, contas a pagar, grupos,
  configurações, área administrativa.
- Bot do Telegram (grammy) para registro rápido de gastos por texto ou voz
  (Whisper via Groq), vinculado à conta web por código.
- Sincronização bancária opcional via Pluggy/Open Finance (atrás de feature
  flag, custo mensal).
- Monetização via assinatura (Mercado Pago: planos Free/Pro/Família) e Pix
  manual.
- App mobile (Expo) existe apenas como scaffold, sem telas reais — fora do
  escopo do redesign visual atual (Workstream 5 trata mobile como etapa
  separada, futura).

## Capabilities and Constraints

- CRUD completo de transações, orçamentos, categorias (sistema + usuário,
  hierárquicas), contas financeiras (checking/savings/credit_card/
  investment/wallet), metas e contas recorrentes.
- Import de extrato CSV/OFX com dedup por `externalId`; diferenciação
  débito/crédito por conta.
- Insights de IA (Groq/Llama 3.3): resumo mensal, detecção de recorrências,
  forecast de orçamento, consultas em linguagem natural.
- Área administrativa (roles user/support/admin): gestão de usuários/planos,
  checkouts, métodos de pagamento, configuração de IA com limites de uso.
- PWA (add to home screen).
- Stack: Next.js (App Router) + Tailwind v4 com tokens `oklch()`,
  componentes hand-rolled em `components/ui/` com
  `class-variance-authority` (sem shadcn CLI). Sem lib de animação hoje
  (`framer-motion` etc. não instalado).
- Idioma: PT-BR em toda a interface e comunicação.

## Brand Commitments

Nome do produto ainda não formalizado como marca (uso interno "finances").
Identidade visual atual (paleta indigo em OKLCH, dark mode preto puro) é
tratada como **anti-referência** para o Workstream 5 — o usuário optou por
substituição deliberada, não preservação. Nenhum outro compromisso de marca
(logo, tom de voz formal, tipografia) confirmado até aqui.

## Evidence on Hand

- `docs/features.md`: mapa completo de funcionalidades por fase, já
  implementadas em produção.
- Nenhum dado de cliente real, depoimento, case ou benchmark de mercado
  disponível — não inventar essas evidências em trabalho futuro.

## Product Principles

1. Compartilhamento em grupo é o mecanismo central, não um extra — todo
   design deve deixar claro "de quem" é cada dado quando há múltiplos
   membros.
2. Registro de gasto tem que ser rápido (via bot) e a visão consolidada
   tem que ser clara (via web) — são dois modos de uso complementares, não
   concorrentes.
3. PT-BR e formatos brasileiros (moeda, data, categorias) são regra, não
   exceção.
4. Simplicidade para o usuário leigo em finanças; recursos avançados (IA,
   Open Finance) ficam disponíveis mas não são pré-requisito de uso.
5. Área administrativa e fluxos de pagamento exigem clareza e confiança
   visual acima de expressividade — é dinheiro real.

## Accessibility & Inclusion

Nenhum requisito de acessibilidade específico confirmado além dos padrões
gerais (WCAG AA como piso razoável para um produto financeiro usado por
público amplo, incluindo usuários menos familiarizados com tecnologia).
