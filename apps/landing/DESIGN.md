---
name: ControlAI — landing
description: Página de anúncio do ControlAI montada como o fechamento do mês de uma família, no mundo "Fechamento de Caixa" do app.
colors:
  marker: "#ffc300"
  azul: "#2563eb"
  ink: "#1c1c1e"
  ink-2: "#45454c"
  ink-3: "#5b5b63"
  paper: "#fafaf9"
  paper-2: "#ededea"
  sheet: "#ffffff"
  rule: "#d6d5d0"
  night: "#1c1c1e"
  night-rule: "#3a3a3f"
  night-ink: "#f4f4f2"
  night-ink-2: "#c9c9ce"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "clamp(46px, 6.6vw, 84px)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "clamp(34px, 4.4vw, 52px)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "clamp(26px, 2.6vw, 32px)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  label-title:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
  body-lead:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(17px, 1.5vw, 20px)"
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.4
  money:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "15.5px"
    fontWeight: 500
    letterSpacing: "-0.01em"
    fontFeature: "\"tnum\""
rounded:
  object: "4px"
  tail: "6px"
  inner: "8px"
  control: "12px"
  container: "16px"
  bubble: "18px"
  device-screen: "36px"
  device: "46px"
  pill: "9999px"
spacing:
  gutter: "20px"
  gutter-sm: "32px"
  section: "96px"
  section-md: "128px"
  container-max: "1240px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "0 28px"
    height: "56px"
  button-marker:
    backgroundColor: "{colors.marker}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 28px"
    height: "56px"
  button-outline:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "48px"
  header-cta-hero:
    backgroundColor: "{colors.marker}"
    textColor: "{colors.ink}"
    rounded: "10px"
    padding: "10px 16px"
  header-cta-scrolled:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "10px"
    padding: "10px 16px"
  segmented-option-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.inner}"
    padding: "0 16px"
    height: "40px"
  suggestion-chip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "40px"
  suggestion-chip-selected:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
  ledger-sheet:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.container}"
    padding: "24px 32px"
  plan-card-featured:
    backgroundColor: "{colors.night}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.container}"
    padding: "28px"
---

# Design System: ControlAI — landing

## Overview

**Creative North Star: "Fechamento de Caixa"**

A landing herda o mundo do app (`apps/web/DESIGN.md`) e o leva para uma superfície de persuasão: a página inteira é um extrato. Papel e grafite são chão e tinta; réguas finas de extrato separam as seções no lugar de cards; os valores em dinheiro alinham em mono tabular como coluna de planilha; o total fecha com régua dupla, como no fechamento contábil. O amarelo-marcador é um grifo de caneta, não uma cor de marca espalhada: um elemento por viewport, e o resto da tela fica em grafite.

O ritmo alterna faixas de papel, papel-fosco e faixas noturnas em grafite (papéis do grupo, plano Família, chamada final, rodapé). Os objetos do produto são desenhados em CSS (o celular com o assistente, o cupom fiscal), nunca capturas de tela. O movimento é escasso e tem um único momento autoral: o extrato "fecha" ao entrar na tela. As superfícies do navegador (seleção, foco, barra de rolagem, cor do tema) também pertencem ao sistema.

Anti-referência herdada e confirmada: a identidade antiga do produto (indigo saturado, dark mode preto puro). Esta landing não a usa em nenhuma forma.

**Key Characteristics:**
- Extrato como estrutura: réguas de 1px, colunas, total sob régua dupla.
- Um grifo amarelo por viewport; o CTA do cabeçalho cede o amarelo depois do hero.
- Dinheiro sempre em IBM Plex Mono tabular, sem quebra entre "R$" e o número.
- Faixas noturnas em grafite marcam mudança de assunto, não decoração.
- Objetos desenhados (celular, cupom) no lugar de mockups e screenshots.
- Um momento de movimento (fechamento do extrato), tudo visível sem JS e com movimento reduzido.

## Colors

Neutros grafite e papel com uma caneta amarela e um azul que só significa saldo positivo.

### Primary
- **Amarelo-marcador** (`marker`): o grifo. Aparece como CTA do cabeçalho no topo, o "no azul" sob o saldo do extrato, a categoria reconhecida no cupom, o botão do plano Família e o botão da chamada final; cada um sozinho no seu viewport. Também é a cor de `::selection` e do anel de foco sobre faixas noturnas. Texto sobre ele é sempre grafite (10.6:1).

### Secondary
- **Azul-no-azul** (`azul`): saldo positivo e entradas ("+ 6.400,00", "+ R$ 3.160,00"). Nunca em links, ícones ou botões.

### Neutral
- **Grafite** (`ink`): tinta do texto, botão primário fora do hero, régua dupla e régua grossa do cabeçalho do extrato, anel de foco no claro.
- **Grafite médio** (`ink-2`): corpo de texto e descrições.
- **Grafite claro** (`ink-3`): rótulos, datas, notas e meta-informação (5.7:1 sobre papel-fosco).
- **Papel** (`paper`): chão da página, cabeçalho fixo, tela do celular desenhado, `theme-color`.
- **Papel-fosco** (`paper-2`): faixas alternadas (extrato, planos), avatares de iniciais, campo de digitar do celular.
- **Folha** (`sheet`): branco puro das folhas sobre o papel (folha do extrato, cards de planos, painéis da seção de recursos, balões do assistente). Vem do `white` do Tailwind, não do `@theme`.
- **Régua de extrato** (`rule`): toda hairline, divisor de linha e borda de folha; também a cor da barra de rolagem.
- **Noite** (`night`, `night-rule`, `night-ink`, `night-ink-2`): o mesmo grafite como faixa escura, com régua, tinta e texto secundário próprios (texto secundário a 10.3:1).

O vermelho do idioma "no vermelho" pertence ao mundo herdado, mas a landing não mostra saldo negativo: débitos ficam em grafite com o sinal "−".

### Named Rules
**The One Marker Rule.** Um único elemento amarelo por viewport. No hero ele é do CTA do cabeçalho, por isso o CTA do hero é grafite; quando o hero sai por baixo do cabeçalho, o CTA do cabeçalho vira grafite e cede o amarelo à seção da vez.

**The Native Idiom Rule.** Azul só significa dinheiro positivo. Se não é um valor ou um saldo, não é azul.

**The Night Band Rule.** Faixas noturnas usam o grafite da tinta (`night` = `ink`), nunca preto puro, e trocam régua, texto e foco pelos pares `night-*` e pelo anel amarelo.

## Typography

**Display Font:** Plus Jakarta Sans 600/700/800 (fallback: system-ui, sans-serif)
**Body Font:** Inter (fallback: system-ui, sans-serif)
**Label/Mono Font:** IBM Plex Mono 400/500 (fallback: ui-monospace, monospace)

**Character:** títulos geométricos e compactos em 800 com tracking negativo, corpo neutro em Inter, e a mono de planilha para cada número de dinheiro. As famílias são as do app por compromisso de marca: quem chega pela landing reconhece o produto. Carregadas via `next/font`, servidas do próprio site.

### Hierarchy
- **Display** (800, clamp(46px, 6.6vw, 84px), 0.98, -0.035em): só o título do hero, `text-balance`. A chamada final usa um degrau intermediário (800, clamp(38px, 5.2vw, 64px), 1.02, -0.03em) sobre a faixa noturna.
- **Headline** (800, clamp(34px, 4.4vw, 52px), 1.05, -0.025em): título de cada seção, largura de 640 a 760px.
- **Title** (700, clamp(26px, 2.6vw, 32px), 1.15, -0.015em): títulos das linhas de recurso. Títulos de folha e de card ficam em 700 entre 15 e 22px (nome do plano 22px, "Extrato · Família Souza" 17px).
- **Body lead** (400, clamp(17px, 1.5vw, 20px), 1.6): subtítulo do hero, máx. 540px.
- **Body** (400, 17-18px, 1.65): introdução de seção e texto de recurso, máx. 460-480px; respostas do FAQ em 16.5px/1.7, máx. 62ch.
- **Label** (400-500, 12.5-14.5px): notas, rótulos de campo, legenda "Valores de exemplo", em `ink-3`. Sem caixa alta e sem tracking aberto.
- **Money** (400-500, IBM Plex Mono, `tnum`, -0.01em, `nowrap`): todo valor, data e contagem; total do extrato em clamp(24px, 3vw, 32px), preço do plano 36px.

### Named Rules
**The Ledger Number Rule.** Todo valor em dinheiro usa a classe `money`: mono, `tabular-nums`, sem quebra entre o símbolo e o número. Texto corrido nunca usa a mono.

**The Kerned Punctuation Rule.** Todo título em Plus Jakarta 800 passa pelo helper `kern()`, que puxa ponto e vírgula 0.06em de volta para a palavra; com o tracking negativo dos títulos, a pontuação descolaria ("dinheiro .").

## Layout

Coluna única de seções em largura total, cada uma com o conteúdo num container centralizado de 1240px e calha lateral de 20px (32px a partir de 640px). Respiro vertical de seção fixo: 96px, 128px a partir de 768px (a chamada final usa 112px). As seções se separam por troca de chão (papel, papel-fosco, noite) e por régua de 1px no topo ou na base, nunca por cards flutuando.

Composições em duas colunas assimétricas a partir de 1024px: hero em 1.15fr/1fr (texto à esquerda, celular de 356px à direita), extrato com folha + coluna de margem de 280px, papéis em 5fr/7fr, FAQ em 4fr/7fr. As linhas de recurso alternam texto (44%) e objeto lado a lado a partir de 768px, separadas por réguas. Abaixo dos breakpoints tudo empilha; a tabela de papéis vira uma lista por papel abaixo de 640px em vez de rolar de lado. O cabeçalho é fixo, com `scroll-padding-top` de 80px para as âncoras.

## Elevation & Depth

Interface plana em repouso: folhas brancas sobre papel delimitadas por régua de 1px, sem sombra. Profundidade aparece em dois casos só: objetos físicos desenhados (o celular e o cupom fiscal, com sombra longa de espalhamento negativo, como objeto sobre a mesa) e resposta a hover em botões (sobe 1px e ganha uma sombra curta).

### Shadow Vocabulary
- **Objeto: celular** (`box-shadow: 0 40px 80px -36px rgba(28,28,30,0.55), 0 2px 6px rgba(28,28,30,0.25)`): só o celular desenhado.
- **Objeto: cupom** (`box-shadow: 0 18px 36px -22px rgba(28,28,30,0.55), 0 1px 2px rgba(28,28,30,0.12)`): só o cupom fiscal, girado -2.5deg.
- **Hover de CTA grande** (`box-shadow: 0 14px 30px -16px rgba(28,28,30,0.7)`; na versão amarela `0 14px 30px -14px rgba(255,195,0,0.75)`): CTAs de 56px, com `translateY(-1px)`.
- **Hover de CTA pequeno** (`box-shadow: 0 6px 16px -8px rgba(28,28,30,0.45)` a `0.6`): CTA do cabeçalho; botões dos planos usam `0 8px 20px -14px` (grafite) e `0 10px 24px -12px` (amarelo).

### Named Rules
**The Drawn Object Rule.** Sombra em repouso é privilégio de objeto físico desenhado (celular, cupom). Folha, card e painel de interface são planos e se delimitam por régua.

Desvio registrado, não vocabulário: a folha do extrato construída carrega uma sombra ambiente em repouso (`0 28px 56px -40px rgba(28,28,30,0.4)`), contra esta regra e a The Flat Ledger Rule do app. Não reproduzir em novas folhas.

## Shapes

Cantos médios e consistentes em folhas e controles: folhas e painéis em 16px, botões e chips em 12px, opções internas em 8px. Formas redondas ficam para o que é redondo no mundo real: avatares de iniciais, pílula do grupo, campo de digitar e botão de enviar do celular, barra de check-in. O celular desenhado tem moldura de 46px e tela de 36px; os balões de conversa têm 18px com o canto do remetente em 6px; o cupom, papel de verdade, tem só 4px. Bordas são sempre 1px em `rule` (ou `night-rule`), com duas exceções contábeis: a régua de 2px em grafite sob o cabeçalho do extrato e a régua dupla de 3px sobre o total. O rascunho do app pedia raio pequeno e nada de pílula; a landing construída usa os raios acima e é isso que fica registrado aqui.

## Components

### Buttons
Diretos e pesados, sempre com palavra de ação ("Criar conta grátis").
- **Shape:** cantos de 12px; CTA do cabeçalho em 10px.
- **Primary:** fundo grafite, texto papel, 600 a 17px, altura mínima de 56px, 28px de lado. É o CTA do hero.
- **Marker:** mesma forma em amarelo com texto grafite; só onde ele é o único amarelo do viewport (chamada final, plano Família).
- **Outline:** borda grafite de 1px sobre a folha, altura mínima de 48px (planos Free e Pro).
- **Hover / Focus:** sobe 1px com a sombra de hover (200ms, 300ms no cabeçalho); foco é contorno de 2px em grafite com afastamento de 3px e canto de 6px, amarelo sobre faixa noturna.
- **Link secundário:** texto sublinhado com afastamento de 6px e sublinhado em `ink-3` a 60%, que escurece no hover ("Ver planos e preços").

### Chips
- **Style:** sugestões do assistente dentro do celular: 40px de altura, borda `rule`, fundo papel, texto `ink-2` a 13.5px com ícone de enviar.
- **State:** selecionada ganha borda grafite, fundo folha e texto grafite (`aria-pressed`); hover escurece borda e texto.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** folha branca sobre papel ou papel-fosco; noite no plano em destaque.
- **Shadow Strategy:** plano (ver Elevation & Depth).
- **Border:** 1px `rule`; internamente, linhas separadas por réguas (`divide-y`), nunca por caixas aninhadas.
- **Internal Padding:** 20 a 32px.

### Navigation
- Cabeçalho fixo em papel sólido com régua de base, sem desfoque. Logo + "ControlAI" em Jakarta 800 a 19px, links de seção a 15px em `ink-2` que escurecem no hover (a partir de 768px), "Entrar" em texto, e o CTA que troca de amarelo para grafite ao sair do hero.
- Rodapé na faixa noturna com os mesmos links em `night-ink-2`.

### Segmented control
- Grupo de rádio do período de cobrança: moldura de 12px com borda `rule` sobre folha e 4px de respiro; opção marcada em grafite com texto papel, opções de 40px de altura com cantos de 8px.

### Extrato (signature)
A folha do extrato é a peça que define o sistema: cabeçalho com título em Jakarta e mês em mono sobre régua de 2px grafite, linhas com data em mono, descrição, avatar de iniciais com nome e papel de quem lançou, e valor em mono alinhado à direita (entradas em azul); o total fecha sob régua dupla de 3px, com o saldo em mono azul e "no azul" grifado em amarelo. Ao lado, uma coluna de margem com notas da atividade do grupo, cada uma com filete esquerdo em `ink-3` a 40%.

**Movimento (fechamento do extrato):** só arma se o extrato está abaixo da dobra, o JS rodou e o movimento é permitido. Ao cruzar 35% de visibilidade, as linhas assentam de 10px com opacidade, 600ms em `cubic-bezier(0.16, 1, 0.3, 1)`, 90ms de atraso por linha; depois o grifo varre o saldo da esquerda para a direita em 900ms, com 650ms de atraso. Sem JS ou com movimento reduzido, o extrato já aparece fechado.

### Celular desenhado (signature)
Moldura grafite de 46px de canto e 11px de borda, tela de papel com 580px de altura: cabeçalho "Assistente" com pílula do grupo, resumo do mês numa folha, conversa com balão do usuário em grafite e resposta em folha branca com valores em mono, sugestões tocáveis e campo de digitar. Balões entram com `bubble-in` (420ms, 6px e escala 0.98); "digitando…" são três pontos pulsando em 1s. Sempre acompanhado da legenda "Demonstração com dados de exemplo".

### Grifo do marcador
Faixa amarela de 0.42em de altura atrás do texto, assentada a 88% da altura da linha, com 0.08em de sangria lateral. É a única forma do amarelo dentro de texto.

## Do's and Don'ts

### Do:
- **Do** deixar um único elemento amarelo por viewport e fazer o CTA do cabeçalho virar grafite depois do hero (The One Marker Rule).
- **Do** usar `money` (IBM Plex Mono, `tnum`, `nowrap`) em todo valor, data e contagem (The Ledger Number Rule).
- **Do** passar todo título de Plus Jakarta 800 pelo `kern()` (The Kerned Punctuation Rule).
- **Do** estruturar listas, tabelas e comparações com réguas de 1px em `rule`, e fechar totais com régua dupla de 3px em grafite.
- **Do** desenhar os objetos do produto em CSS (celular, cupom) e rotular dados de demonstração como exemplo.
- **Do** marcar mudança de assunto com faixa noturna em `night`, com régua, texto e foco `night-*`.
- **Do** tematizar as superfícies do navegador: seleção em amarelo com texto grafite, foco de 2px, barra de rolagem fina em `rule`, `theme-color` papel.
- **Do** começar todo movimento no estado final sem JS e zerar durações com `prefers-reduced-motion`.

### Don't:
- **Don't** pôr o amarelo em dois elementos no mesmo viewport, nem como fundo de seção inteira.
- **Don't** usar azul em link, ícone ou botão; azul é saldo positivo.
- **Don't** dar sombra em repouso a folha, card ou painel de interface; sombra parada é só de objeto desenhado (The Drawn Object Rule).
- **Don't** usar preto puro nem indigo saturado; a faixa escura é o grafite `#1c1c1e`.
- **Don't** usar `backdrop-filter` no cabeçalho fixo; o fundo é papel sólido.
- **Don't** usar a mono em texto corrido.
