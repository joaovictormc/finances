---
version: 1
slug: "apps-landing-app-page-tsx"
primary_target: "apps/landing/app/page.tsx"
related_targets: []
---

# Surface brief — landing page de anúncio (apps/landing)

## Scope and mode

Persuade. Página única de anúncio do ControlAI em `apps/landing` (Next.js estático). Visitante: casal ou família brasileira que divide as contas e ainda controla em planilha, caderno ou em app individual. Ação: criar conta grátis na web (o app mobile ainda não está nas lojas: "em breve").

## Inputs confirmed with the user

- Direção aprovada: esboço C (`docs/landing/c-produto-em-acao.html`) incrementado com elementos de A (extrato da família, "no azul", FAQ) e B (papéis do grupo, atividade, plano Família).
- Preços lidos da API pública de planos (build + atualização no navegador); nunca fixos.
- URL do app via `NEXT_PUBLIC_APP_URL` (ainda não definida). App mobile: "em breve" nas lojas.
- Mundo visual herdado: "Fechamento de Caixa" (`apps/web/DESIGN.md`) — papel, grafite, amarelo-marcador raro, azul/vermelho só para saldo, números em mono. Fontes do produto (Plus Jakarta Sans, Inter, IBM Plex Mono) mantidas por compromisso de marca: a landing tem que parecer o mesmo produto em que o visitante vai entrar.
- Sem depoimentos, números de clientes, avaliações ou imprensa. Dados de demonstração rotulados como exemplo.

## Direction contract

THESIS: A página é o fechamento do mês de uma família, feito na frente do visitante: o dinheiro responde perguntas e o extrato é assinado por cada pessoa. Recusa o hero genérico de SaaS (título + mockup estático + fileira de cards iguais) e qualquer número de vaidade.

OWN-WORLD: Papel #FAFAF9 e papel-fosco #EDEDEA como chão; grafite #1C1C1E como tinta e como faixas escuras; réguas finas de extrato (#D6D5D0) estruturam as seções em vez de cards; amarelo-marcador #FFC300 em um único elemento por viewport (CTA ou o saldo "no azul" grifado); azul #2563EB só para saldo positivo; valores em IBM Plex Mono tabular; títulos Plus Jakarta Sans 800, corpo Inter.

STORY: Em segundos: "é um app de finanças da família que responde perguntas e mostra quem lançou o quê". Depois: vê o extrato assinado, entende os papéis do grupo, vê cupom e extrato do banco entrando sem digitar e o hábito de pontos, compara planos com preço real e cria a conta grátis.

FIRST VIEWPORT: Faixa de navegação fina (logo, Como funciona, Família, Planos, Dúvidas, Entrar, CTA amarelo "Criar conta grátis" que vira grafite ao sair do hero). Coluna esquerda (~55%): título em 3 linhas até 84px "Pergunte pro seu dinheiro. Ele responde.", subtítulo curto, CTA grafite "Criar conta grátis" + link "Ver planos e preços", linha "Funciona no navegador hoje. App para iPhone e Android em breve." Coluna direita: celular desenhado em CSS, ~356px, com o resumo do mês, o assistente respondendo e as três perguntas clicáveis como sugestões dentro da tela, acima do campo de digitar; etiqueta "Demonstração com dados de exemplo" sob o celular. Emenda: as perguntas foram planejadas abaixo do celular, mas em telas de 800–900px de altura ficavam fora da primeira dobra; dentro da tela, como sugestões de chat, a interação cabe sempre no primeiro viewport e usa a convenção nativa de apps de conversa.

SIGNATURE INTERACTION: Perguntas de exemplo clicáveis no hero: o celular digita a pergunta e a resposta chega com os números em mono. Motion grammar: um momento autoral — o extrato "fecha" ao entrar na tela: as linhas assentam uma a uma e o grifo amarelo varre o saldo "no azul". Tudo visível por padrão; respeita prefers-reduced-motion.

FORM: Extrato/planilha de fechamento de caixa como estrutura da página (réguas, colunas, linha de total com régua dupla). A rodada de direção foram os três esboços revisados pelo usuário em `docs/landing/` (A · Fechamento de Caixa, B · Família no centro, C · Produto em ação), no lugar do concept-seed. Escolha do usuário, citada: "podemos seguir com o plano C, mas podemos incrementar ele com elementos e áreas dos planos A e B".

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Domínios da landing e do app.
- Links de Termos de uso e Privacidade (páginas ainda não existem no app).
- Links das lojas quando o app for publicado.
