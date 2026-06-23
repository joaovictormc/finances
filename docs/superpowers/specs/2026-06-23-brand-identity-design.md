# Identidade de marca: nome e logomarca

## Contexto

O projeto hoje usa só o nome genérico de pasta/PWA "Finances" e um ícone placeholder (cifrão branco sobre fundo indigo, `apps/web/public/icons/icon-*.png`). Antes do primeiro commit de documentação completa do projeto, o usuário pediu para definir nome e logomarca oficiais. Sessão de brainstorming (com companion visual) testou várias linhas de nome (trocadilhos PT-BR, nomes abstratos, linha "Desk Finance") e várias direções de ícone (dial, sparkle, barras+nó, traço único) até convergir.

## Nome

**ControlAI** — comunica diretamente os dois pilares do produto: controle financeiro + inteligência artificial (Groq, insights, bot conversacional). Evita colisão com nomes já usados no mercado BR (Contai, Poupai, Finbo, FinDesk, FiniDesk).

## Logomarca

**Ícone:** um traço único branco (sem composição de elementos soltos) formando uma linha de tendência ascendente em 3 segmentos, terminando numa bolinha cheia do mesmo traço (a bolinha é a ponta da própria linha, não um elemento separado por cima). Fundo: quadrado arredondado indigo (`#6366f1`, raio ≈ 23% do lado — mesmo valor já usado nos ícones atuais), mesma cor do `--color-primary` do tema.

SVG de referência (viewBox 0 0 96 96):
```svg
<rect width="96" height="96" rx="22" fill="#6366f1"/>
<path d="M24 66 L42 50 L54 59 L72 28" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="72" cy="28" r="8" fill="#ffffff"/>
```

**Wordmark:** "Control" + "AI", mesma fonte do app (Geist, peso 700). "Control" usa a cor de texto padrão do tema (`--color-foreground`); "AI" usa indigo (`--color-primary` no claro, um indigo mais claro como `#a5a6f6` no escuro, pra manter contraste).

## Onde aplicar

1. **Ícone mestre:** novo `apps/web/public/icons/logo.svg` com o SVG de referência acima — fonte única pra gerar os demais formatos.
2. **PWA icons:** regenerar `icon-192.png`, `icon-512.png` e `apple-touch-icon.png` (180×180) a partir do `logo.svg`, via script temporário com `sharp` (já presente na árvore de dependências — `node_modules/.pnpm/sharp@*`), seguindo o padrão já usado neste projeto de scripts `.ts` temporários deletados após o uso.
3. **`apps/web/public/manifest.json`:** `name`/`short_name` → "ControlAI".
4. **`apps/web/app/layout.tsx`:** `metadata.title` (default + template `%s | ControlAI`), `metadata.appleWebApp.title` → "ControlAI".
5. **Componente de logo no app:** novo `apps/web/components/ui/logo.tsx` (ícone SVG inline + wordmark, prop pra mostrar só o ícone ou ícone+texto) — substitui o uso hoje hardcoded em `apps/web/app/(dashboard)/layout.tsx` (cabeçalho com texto fixo) e em qualquer outro lugar que hoje exiba o nome do produto.
6. **Documentação:** `docs/README.md` (título do documento) e demais arquivos de `docs/` que mencionam "Financeiro"/"Finances" como nome do produto.
7. **`package.json` raiz:** campo `name` (identificador interno do workspace pnpm) **não é alterado** — é só o slug técnico do monorepo, sem visibilidade pro usuário final; renomear isso é risco desnecessário (scripts, CI, paths) sem benefício de marca.

## Fora de escopo
Registro de marca/domínio; favicon animado; variações de logo para redes sociais além do ícone circular já descartado nesta sessão (o ícone final é quadrado arredondado, igual ao PWA).

## Verificação
- Abrir `/manifest.json` no navegador e confirmar `name`/`short_name` atualizados.
- Adicionar à tela inicial (PWA) e confirmar que o ícone novo aparece (Android/iOS usam os PNGs regenerados).
- Verificar o `<title>` da aba do navegador em qualquer página do dashboard → deve mostrar "... | ControlAI".
- Conferir visualmente o componente `Logo` no cabeçalho do dashboard, em tema claro e escuro.
