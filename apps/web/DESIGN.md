<!-- SEED: established with the user before implementation; re-run /impeccable document once there's code to capture the actual tokens and components. -->

---
name: finances
description: Painel financeiro familiar em PT-BR, redesenhado como um extrato de fechamento de caixa moderno.
---

# Design System: finances — "Fechamento de Caixa"

## Overview

**Creative North Star: "Fechamento de Caixa"**

O sistema parte do ritual de bater o balanço no fim do mês: um extrato ou
planilha de fechamento, redesenhado limpo e contemporâneo. A base é
minimalista e séria — grafite quase-preto sobre papel, réguas finas como
linhas de extrato, números alinhados em colunas como uma planilha contábil.
Contra esse fundo neutro, uma única cor de assinatura funciona como
marcador de destaque (highlighter): isola exatamente o que precisa de
atenção — CTA, número-chave, estado ativo — sem competir com a seriedade do
resto da tela.

O status financeiro usa o idiomatismo do próprio usuário: "estar no azul"
(positivo) e "estar no vermelho" (negativo) — cor com significado nativo em
português, não decoração arbitrária. Esse par fica reservado para
status/saldo; a cor de assinatura (amarelo-marcador) nunca compete com azul
ou vermelho pelo mesmo significado.

Anti-referência confirmada: a identidade anterior (indigo saturado, dark
mode preto puro genérico) é tratada como evidência do que o produto foi,
não como base — este sistema a substitui deliberadamente, não a refina.

**Key Characteristics:**
- Minimalista e sério: muito respiro, poucas cores, hierarquia clara.
- Números financeiros sempre monoespaçados, alinhados como planilha.
- Uma cor de assinatura (marcador amarelo) usada com raridade deliberada.
- Status positivo/negativo mapeado ao jargão real do usuário (azul/vermelho).
- Copy usa jargão financeiro leve e próximo, não bancário-formal.

## Colors

Paleta restrita: base neutra grafite/papel, dupla semântica azul/vermelho
para status financeiro, e uma única cor de assinatura para destaque.
Valores exatos (incluindo formato OKLCH, consistente com os tokens já
usados no projeto) serão fixados na implementação; abaixo, os valores
acordados na direção aprovada pelo usuário como ponto de partida.

### Primary
- **Amarelo-marcador** (`oklch(85% 0.17 95)` ≈ `#FFC300`): cor de
  assinatura da marca. Usada só em CTAs primários, estados ativos e
  números-chave que precisam prender a atenção. Raridade é o ponto — nunca
  vira cor de fundo de seção inteira.

### Secondary
- **Azul-no-azul** (`oklch(55% 0.18 250)` ≈ `#2563EB`): status financeiro
  positivo (saldo positivo, meta batida, "no azul").
- **Vermelho-no-vermelho** (`oklch(55% 0.20 25)` ≈ `#DC2626`): status
  financeiro negativo ("no vermelho", conta vencida, orçamento estourado).

### Neutral
- **Grafite quase-preto** (`oklch(21% 0.006 285)` ≈ `#1C1C1E`): texto
  principal, superfícies escuras, base do modo escuro.
- **Papel** (`oklch(98% 0.003 90)` ≈ `#FAFAF9`): fundo principal, base do
  modo claro.
- **Papel-fosco** (`oklch(94% 0.004 90)` ≈ `#EDEDEA`): superfícies
  secundárias (cards, inputs em repouso).
- **Linha-de-extrato** (`oklch(85% 0.005 90)` ≈ `#D6D5D0`): hairlines,
  divisores de tabela, réguas de coluna.

### Named Rules
**The One Marker Rule.** O amarelo-marcador aparece em no máximo um
elemento por viewport relevante. Se duas coisas competem por ele, nenhuma
ganha — volta pro grafite/papel até a hierarquia ficar clara.

**The Native Idiom Rule.** Azul e vermelho só representam status financeiro
(positivo/negativo). Nunca são usados como cor decorativa ou de marca —
isso quebraria o vínculo com o jargão "no azul/no vermelho" que o usuário
já entende.

## Typography

**Display Font:** Plus Jakarta Sans (fallback: system-ui, sans-serif)
**Body Font:** Inter (fallback: system-ui, sans-serif)
**Label/Mono Font:** IBM Plex Mono (fallback: ui-monospace, monospace)

**Character:** geométrica e neutra para texto de interface (Plus Jakarta
Sans nos títulos, Inter no corpo), monoespaçada para todo número
financeiro — reforça a leitura de planilha/extrato e garante alinhamento
perfeito de colunas de valores.

### Hierarchy
- **Display** (600, clamp(1.75rem, 3vw, 2.5rem), 1.1): títulos de página,
  saldo consolidado em destaque.
- **Headline** (600, 1.25rem, 1.2): títulos de seção/card.
- **Title** (500, 1rem, 1.3): cabeçalhos de tabela, rótulos de card.
- **Body** (400, 0.9375rem, 1.5): texto de interface, copy, descrições
  (65–75ch de largura máxima em blocos de texto).
- **Label** (500, 0.75rem, 1.2, uppercase, letter-spacing 0.04em):
  rótulos de status, badges, cabeçalhos de coluna.
- **Ledger (mono)** (500, 0.9375rem tabular-nums, 1.4): todo valor
  monetário, saldo, número de conta — sempre `font-variant-numeric:
  tabular-nums`.

### Named Rules
**The Ledger Number Rule.** Qualquer número que representa dinheiro (saldo,
valor de transação, meta, orçamento) é monoespaçado com `tabular-nums`.
Texto comum nunca usa a fonte mono.

## Layout

Grid denso o suficiente para checagem rápida (uso frequente e curto,
confirmado pelo usuário), mas com respiro generoso entre seções — nunca
comprime números a ponto de prejudicar leitura. Container principal
centralizado com padding lateral consistente; tabelas de transação usam
largura total disponível com colunas alinhadas por régua fina
(`linha-de-extrato`). Detalhes exatos de spacing scale a confirmar na
implementação (camada 1: tokens globais).

## Elevation & Depth

Sistema majoritariamente flat: sem sombras difusas decorativas. Profundidade
vem de contraste tonal (papel vs. papel-fosco) e da régua fina de divisor,
como um documento impresso, não como um app com camadas flutuantes. Sombra,
quando existir, é estrutural (indicar elemento fixo/sobreposto, ex: modal,
drawer), nunca ambiente.

### Named Rules
**The Flat Ledger Rule.** Superfícies em repouso são planas. Elevação só
aparece como resposta a estado (drawer aberto, modal, dropdown) — nunca
como decoração de card.

## Shapes

Cantos discretos e consistentes (raio pequeno, a fixar exato na
implementação — não circular/pill, evita parecer app lúdico). Bordas finas
de 1px em `linha-de-extrato` no lugar de sombra para delimitar cards e
inputs.

## Components

Camada a implementar sobre os tokens acima (Workstream 5, passo 2 do
plano). Nenhum componente ainda foi reconstruído nesta direção — a lista
abaixo registra a intenção confirmada, não implementação existente.

### Buttons
- **Shape:** cantos discretos (raio pequeno, mesmo valor do Shapes).
- **Primary:** fundo amarelo-marcador, texto grafite (contraste alto,
  nunca texto branco sobre amarelo).
- **Hover/Focus:** leve escurecimento do amarelo + anel de foco visível
  (acessibilidade, sem depender só de cor).
- **Secondary/Ghost:** borda `linha-de-extrato`, texto grafite, fundo
  transparente.

### Chips / Badges de status
- **Style:** fundo tonal claro do status-blue ou status-red (baixa
  saturação de fundo, texto na cor cheia) — nunca fundo sólido saturado
  competindo com o amarelo-marcador.

### Cards / Containers
- **Corner Style:** raio pequeno (Shapes).
- **Background:** papel ou papel-fosco.
- **Shadow Strategy:** flat por padrão (ver Elevation & Depth).
- **Border:** 1px `linha-de-extrato`.

### Inputs / Fields
- **Style:** borda `linha-de-extrato`, fundo papel-fosco em repouso.
- **Focus:** borda grafite + leve anel, sem glow colorido.

### Navigation
- A definir na implementação por camadas (tokens → componentes → páginas);
  deve seguir a mesma disciplina de raridade do amarelo-marcador para o
  item ativo.

## Do's and Don'ts

### Do:
- **Do** reservar o amarelo-marcador para no máximo um destaque por
  viewport (The One Marker Rule).
- **Do** usar azul/vermelho exclusivamente para status financeiro
  positivo/negativo (The Native Idiom Rule).
- **Do** manter todo valor monetário em fonte monoespaçada com
  `tabular-nums` (The Ledger Number Rule).
- **Do** manter o sistema flat em repouso, elevação só por estado (The
  Flat Ledger Rule).
- **Do** escrever copy com jargão financeiro leve e próximo ("fechou o mês
  no azul", "bateu a meta") em vez de tom bancário-formal.

### Don't:
- **Don't** usar gradientes roxo-azul ou paleta indigo saturada — é a
  identidade anterior sendo substituída, não uma referência.
- **Don't** deixar efeito visual (textura, sombra, animação) atrasar ou
  esconder a leitura de um número financeiro.
- **Don't** usar o amarelo-marcador como cor de fundo de seção inteira ou
  em mais de um elemento concorrente por tela.
- **Don't** introduzir gamificação/tom lúdico (confete, badges de
  conquista chamativos) — é dinheiro real, o tom é sério mesmo quando
  bonito.
