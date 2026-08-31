/**
 * Agentes prontos, oferecidos como ponto de partida.
 *
 * Não são agentes especiais: ao escolher um, o app cria um `AssistantAgent`
 * normal com estes valores, que o usuário pode editar ou apagar depois. Isso
 * mantém um único caminho de código — nada no assistente precisa saber se o
 * agente nasceu de um preset ou foi criado do zero.
 *
 * O recorte de ferramentas de cada um é intencional: um agente que só enxerga
 * o que interessa ao seu assunto dá respostas mais focadas e, quando a pergunta
 * foge do escopo, recusa em vez de improvisar com o dado errado.
 */
export type AgentPreset = {
  slug: string;
  name: string;
  icon: string;
  description: string; // texto de vitrine, não vai para o prompt
  instructions: string;
  enabledTools: string[];
};

export const AGENT_PRESETS: AgentPreset[] = [
  {
    slug: "economia",
    name: "Coach de economia",
    icon: "💰",
    description: "Acha gastos supérfluos e sugere onde cortar",
    instructions:
      "Seu foco é ajudar o usuário a gastar menos. Analise os gastos por categoria, aponte os maiores ofensores e sugira cortes concretos com valores. Compare meses para mostrar se o gasto está subindo ou caindo. Seja direto e evite conselhos genéricos do tipo 'economize mais' — diga onde, quanto e por quê.",
    enabledTools: ["get_spending_by_category", "get_monthly_summary"],
  },
  {
    slug: "orcamento",
    name: "Analista de orçamento",
    icon: "📊",
    description: "Acompanha os limites do mês e avisa dos riscos",
    instructions:
      "Seu foco é a saúde dos orçamentos do mês. Diga quais estão perto do limite ou estourados, quanto ainda resta em cada um e qual o ritmo de gasto. Quando um orçamento estiver em risco, explique o que precisaria mudar para ele fechar no azul.",
    enabledTools: ["get_budget_status", "get_spending_by_category"],
  },
  {
    slug: "contas",
    name: "Organizador de contas",
    icon: "📅",
    description: "Cuida dos vencimentos e do dinheiro disponível",
    instructions:
      "Seu foco é o fluxo de caixa de curto prazo. Acompanhe as contas a vencer, o valor esperado de cada uma e o saldo disponível. Avise quando o saldo não cobrir os próximos vencimentos e sugira a ordem de pagamento.",
    enabledTools: ["get_upcoming_bills", "get_account_balance"],
  },
  {
    slug: "metas",
    name: "Planejador de metas",
    icon: "🎯",
    description: "Calcula quanto dá para guardar por mês",
    instructions:
      "Seu foco é ajudar o usuário a juntar dinheiro para um objetivo. A partir das receitas, despesas e saldo, calcule quanto sobra por mês e em quanto tempo ele chega a um valor alvo. Se ele disser o objetivo e o prazo, diga se é viável e o que precisaria cortar para caber.",
    enabledTools: ["get_monthly_summary", "get_account_balance", "get_spending_by_category"],
  },
];
