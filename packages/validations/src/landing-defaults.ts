import type { LandingMenuItem, LandingSection } from "./landing.schema";

/** Menu de fábrica: as seções da página inicial. */
export const DEFAULT_LANDING_MENU: LandingMenuItem[] = [
  { label: "Como funciona", href: "#extrato" },
  { label: "Família", href: "#familia" },
  { label: "Planos", href: "#planos" },
  { label: "Dúvidas", href: "#duvidas" },
];

/**
 * Conteúdo de fábrica da página inicial — o texto que a landing tinha antes
 * de virar editável. A API usa para criar a página "inicio" na primeira vez;
 * a landing usa como reserva se a API estiver fora do ar.
 *
 * Os números de demonstração conversam entre si (o assistente responde com
 * os mesmos valores do extrato) e são rotulados como exemplo na página.
 */
export const DEFAULT_HOME_SECTIONS: LandingSection[] = [
  {
    id: "hero",
    type: "hero",
    anchor: "topo",
    hidden: false,
    data: {
      title: "Pergunte pro seu dinheiro. Ele responde.",
      subtitle:
        "O ControlAI junta as contas da família num extrato só, assinado por quem lançou cada gasto, e um assistente que responde em português com os números do seu mês.",
      primaryLabel: "Criar conta grátis",
      secondaryLabel: "Ver planos e preços",
      secondaryHref: "#planos",
      note: "Funciona no navegador hoje. App para iPhone e Android em breve.",
      summaryLabel: "Outubro até agora",
      summaryValue: "+ R$ 3.160,00",
      demoLabel: "Demonstração com dados de exemplo",
      exchanges: [
        {
          question: "Quanto gastei com mercado este mês?",
          answer:
            "Em outubro foram R$ 1.182,40 em Supermercado, 79% do orçamento. Ainda cabem R$ 317,60 até o fim do mês.",
        },
        {
          question: "Vamos fechar outubro no azul?",
          answer:
            "Até agora, sim: entraram R$ 6.400,00 e saíram R$ 3.240,00. Saldo de + R$ 3.160,00. Falta a internet, dia 25.",
        },
        {
          question: "Quais contas vencem até o fim do mês?",
          answer: "Só a internet: R$ 119,90, no dia 25. Com ela paga, outubro fecha em + R$ 3.040,10.",
        },
      ],
    },
  },
  {
    id: "extrato",
    type: "ledger",
    anchor: "extrato",
    hidden: false,
    data: {
      title: "O extrato que a família inteira assina.",
      body: "Cada lançamento leva o nome de quem fez. Ninguém precisa perguntar “quem gastou isso?” no fim do mês: está escrito na linha.",
      sheetTitle: "Extrato · Família Souza",
      period: "OUTUBRO 2026",
      rows: [
        { date: "01/10", description: "Salário", initials: "AN", name: "Ana", role: "dona", amount: "+ 6.400,00", income: true },
        { date: "03/10", description: "Escola das crianças", initials: "AN", name: "Ana", role: "dona", amount: "− 1.350,00", income: false },
        { date: "08/10", description: "Supermercado", initials: "RS", name: "Rafael", role: "administrador", amount: "− 1.182,40", income: false },
        { date: "12/10", description: "Combustível", initials: "RS", name: "Rafael", role: "administrador", amount: "− 420,00", income: false },
        { date: "15/10", description: "Conta de luz", initials: "AN", name: "Ana", role: "dona", amount: "− 287,60", income: false },
      ],
      totalLabel: "Saldo de outubro",
      totalAmount: "+ 3.160,00",
      totalMarker: "no azul",
      footer: "Lançado por Ana (3) e Rafael (2)",
      marginTitle: "Na margem, o que o grupo ficou sabendo",
      // Só avisos que o sistema envia de fato ao grupo: entrada de membro
      // (routes/groups.ts) e previsão de estouro de orçamento do grupo
      // (lib/ai/budget-forecast.ts). Não há aviso por gasto lançado nem por meta.
      notes: [
        { when: "02 out", text: "Rafael entrou no grupo pelo link de convite. Todos foram avisados." },
        { when: "12 out", text: "No ritmo atual, Mercado passaria do limite. O grupo todo foi avisado a tempo." },
      ],
    },
  },
  {
    id: "familia",
    type: "roles",
    anchor: "familia",
    hidden: false,
    data: {
      title: "Cada pessoa no seu papel.",
      body: "Quem paga as contas lança, quem organiza administra, o filho adolescente acompanha. Você convida pelo link e escolhe o papel de cada um.",
      note: "Quem é convidado entra de graça. O limite de pessoas vem do plano de quem criou o grupo: até 5 no plano Família.",
    },
  },
  {
    id: "recursos",
    type: "productRows",
    anchor: "recursos",
    hidden: false,
    data: {
      title: "Menos digitação, mais decisão.",
      rows: [
        {
          title: "Fotografou o cupom, o gasto está lançado.",
          body: "No app, a câmera lê valor, data e estabelecimento e sugere a categoria. Você só confere e salva.",
          note: "Leitura de cupom nos planos Pro e Família.",
          visual: "receipt",
        },
        {
          title: "O extrato do banco entra sem digitar.",
          body: "Baixe o extrato no app do banco e importe o arquivo OFX ou CSV, do banco e do cartão. O que já estava lançado não duplica.",
          note: "Em todos os planos.",
          visual: "files",
        },
        {
          title: "Organizar o dinheiro vira hábito.",
          body: "Check-in diário, sequência de dias registrando, Roleta Semanal e emblemas. Pontos por manter a rotina, sem complicar o que importa.",
          note: "Em todos os planos.",
          visual: "habit",
        },
      ],
    },
  },
  {
    id: "planos",
    type: "pricing",
    anchor: "planos",
    hidden: false,
    data: {
      title: "Comece grátis. Chame a família quando quiser.",
      footnote: "Pagamento por Pix ou Mercado Pago. Cancele quando quiser: o plano volta ao Free no fim do período pago.",
    },
  },
  {
    id: "duvidas",
    type: "faq",
    anchor: "duvidas",
    hidden: false,
    data: {
      title: "Dúvidas de quem está começando.",
      items: [
        {
          question: "Preciso digitar tudo à mão?",
          answer:
            "Não. Você importa o extrato do banco e do cartão em OFX ou CSV, em qualquer plano, e o que já estava lançado não duplica. Nos planos Pro e Família, o app também lê o cupom fiscal pela câmera.",
        },
        {
          question: "Quem eu convido para o grupo também paga?",
          answer:
            "Não. Quem recebe o convite entra de graça. O limite de pessoas vem do plano de quem criou o grupo: até 5 no plano Família.",
        },
        {
          question: "Tem app para celular?",
          answer:
            "O app para iPhone e Android está a caminho das lojas. Enquanto isso, a versão web funciona no navegador do celular e pode ser adicionada à tela inicial.",
        },
        {
          question: "Como meus dados ficam protegidos?",
          answer:
            "Você pode ativar a verificação em duas etapas com um app autenticador. E, nas configurações, baixa uma cópia de todos os seus dados ou exclui a conta quando quiser.",
        },
        {
          question: "Posso cancelar quando quiser?",
          answer: "Sim. Ao cancelar, você continua no plano até o fim do período já pago e depois volta para o Free.",
        },
      ],
    },
  },
  {
    id: "fechamento",
    type: "cta",
    anchor: "",
    hidden: false,
    data: {
      title: "Feche o próximo mês no azul. Junto.",
      primaryLabel: "Criar conta grátis",
      primaryHref: "signup",
      secondaryLabel: "Já tenho conta",
      secondaryHref: "login",
    },
  },
];

export const DEFAULT_HOME_PAGE = {
  title: "ControlAI — o dinheiro da família, fechado no azul",
  description:
    "Transações, orçamentos, metas e contas a pagar da família num só lugar, com assistente de IA e cada lançamento assinado por quem fez. Comece grátis.",
};

/** Conteúdo inicial de cada tipo de bloco, quando o admin adiciona um novo. */
export const BLANK_SECTION_DATA: { [K in LandingSection["type"]]: Extract<LandingSection, { type: K }>["data"] } = {
  hero: DEFAULT_HOME_SECTIONS[0]!.data as Extract<LandingSection, { type: "hero" }>["data"],
  ledger: DEFAULT_HOME_SECTIONS[1]!.data as Extract<LandingSection, { type: "ledger" }>["data"],
  roles: DEFAULT_HOME_SECTIONS[2]!.data as Extract<LandingSection, { type: "roles" }>["data"],
  productRows: DEFAULT_HOME_SECTIONS[3]!.data as Extract<LandingSection, { type: "productRows" }>["data"],
  pricing: DEFAULT_HOME_SECTIONS[4]!.data as Extract<LandingSection, { type: "pricing" }>["data"],
  faq: { title: "Perguntas frequentes", items: [{ question: "Nova pergunta", answer: "Resposta." }] },
  cta: { title: "Crie sua conta grátis.", primaryLabel: "Criar conta grátis", primaryHref: "signup", secondaryLabel: "", secondaryHref: "" },
  text: { title: "Título", body: "Escreva o texto aqui.\n\n## Subtítulo\n\nOutro parágrafo.\n\n- Item de lista" },
  highlights: {
    title: "Destaques",
    body: "",
    items: [{ icon: "check", title: "Destaque", text: "Descrição curta." }],
  },
};

/** Nome de cada tipo de bloco no admin. */
export const LANDING_BLOCK_LABELS: Record<LandingSection["type"], string> = {
  hero: "Topo com assistente",
  ledger: "Extrato da família",
  roles: "Papéis do grupo",
  productRows: "Faixas de produto",
  pricing: "Planos e preços",
  faq: "Perguntas frequentes",
  cta: "Chamada para ação",
  text: "Texto",
  highlights: "Lista de destaques",
};
