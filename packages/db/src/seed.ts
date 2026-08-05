import { db } from "./index";

const systemCategories = [
  // EXPENSE categories
  {
    name: "Alimentação",
    icon: "🍽️",
    color: "#f97316",
    type: "expense",
    children: [
      { name: "Supermercado", icon: "🛒", color: "#f97316", type: "expense" },
      { name: "Restaurante", icon: "🍴", color: "#f97316", type: "expense" },
      { name: "Lanche", icon: "🥪", color: "#f97316", type: "expense" },
      { name: "Delivery", icon: "🛵", color: "#f97316", type: "expense" },
      { name: "Padaria", icon: "🥖", color: "#f97316", type: "expense" },
    ],
  },
  {
    name: "Transporte",
    icon: "🚗",
    color: "#3b82f6",
    type: "expense",
    children: [
      { name: "Combustível", icon: "⛽", color: "#3b82f6", type: "expense" },
      { name: "Uber/99", icon: "🚕", color: "#3b82f6", type: "expense" },
      { name: "Transporte Público", icon: "🚌", color: "#3b82f6", type: "expense" },
      { name: "Estacionamento", icon: "🅿️", color: "#3b82f6", type: "expense" },
      { name: "Manutenção Veículo", icon: "🔧", color: "#3b82f6", type: "expense" },
    ],
  },
  {
    name: "Moradia",
    icon: "🏠",
    color: "#8b5cf6",
    type: "expense",
    children: [
      { name: "Aluguel", icon: "🏘️", color: "#8b5cf6", type: "expense" },
      { name: "Condomínio", icon: "🏢", color: "#8b5cf6", type: "expense" },
      { name: "Energia Elétrica", icon: "⚡", color: "#8b5cf6", type: "expense" },
      { name: "Água e Saneamento", icon: "💧", color: "#8b5cf6", type: "expense" },
      { name: "Internet", icon: "🌐", color: "#8b5cf6", type: "expense" },
      { name: "Telefone", icon: "📱", color: "#8b5cf6", type: "expense" },
      { name: "Gás", icon: "🔥", color: "#8b5cf6", type: "expense" },
      { name: "Reforma e Manutenção", icon: "🪛", color: "#8b5cf6", type: "expense" },
    ],
  },
  {
    name: "Saúde",
    icon: "🏥",
    color: "#ef4444",
    type: "expense",
    children: [
      { name: "Plano de Saúde", icon: "💊", color: "#ef4444", type: "expense" },
      { name: "Farmácia", icon: "💉", color: "#ef4444", type: "expense" },
      { name: "Consultas", icon: "👨‍⚕️", color: "#ef4444", type: "expense" },
      { name: "Exames", icon: "🔬", color: "#ef4444", type: "expense" },
      { name: "Academia", icon: "🏋️", color: "#ef4444", type: "expense" },
    ],
  },
  {
    name: "Educação",
    icon: "📚",
    color: "#06b6d4",
    type: "expense",
    children: [
      { name: "Faculdade/Escola", icon: "🎓", color: "#06b6d4", type: "expense" },
      { name: "Cursos e Treinamentos", icon: "💻", color: "#06b6d4", type: "expense" },
      { name: "Livros e Material", icon: "📖", color: "#06b6d4", type: "expense" },
    ],
  },
  {
    name: "Lazer",
    icon: "🎉",
    color: "#ec4899",
    type: "expense",
    children: [
      { name: "Cinema e Teatro", icon: "🎬", color: "#ec4899", type: "expense" },
      { name: "Viagens", icon: "✈️", color: "#ec4899", type: "expense" },
      { name: "Streaming", icon: "📺", color: "#ec4899", type: "expense" },
      { name: "Jogos", icon: "🎮", color: "#ec4899", type: "expense" },
      { name: "Esportes", icon: "⚽", color: "#ec4899", type: "expense" },
      { name: "Bares e Baladas", icon: "🍺", color: "#ec4899", type: "expense" },
    ],
  },
  {
    name: "Vestuário",
    icon: "👕",
    color: "#84cc16",
    type: "expense",
    children: [
      { name: "Roupas", icon: "👔", color: "#84cc16", type: "expense" },
      { name: "Calçados", icon: "👟", color: "#84cc16", type: "expense" },
      { name: "Acessórios", icon: "👜", color: "#84cc16", type: "expense" },
    ],
  },
  {
    name: "Finanças",
    icon: "💰",
    color: "#f59e0b",
    type: "expense",
    children: [
      { name: "Impostos e Taxas", icon: "📋", color: "#f59e0b", type: "expense" },
      { name: "Seguros", icon: "🛡️", color: "#f59e0b", type: "expense" },
      { name: "Investimentos", icon: "📈", color: "#f59e0b", type: "expense" },
      { name: "Empréstimo/Financiamento", icon: "🏦", color: "#f59e0b", type: "expense" },
      { name: "Cartão de Crédito", icon: "💳", color: "#f59e0b", type: "expense" },
    ],
  },
  {
    name: "Pet",
    icon: "🐾",
    color: "#a78bfa",
    type: "expense",
    children: [
      { name: "Ração e Petisco", icon: "🦴", color: "#a78bfa", type: "expense" },
      { name: "Veterinário", icon: "🩺", color: "#a78bfa", type: "expense" },
      { name: "Banho e Tosa", icon: "🛁", color: "#a78bfa", type: "expense" },
    ],
  },
  {
    name: "Outros Gastos",
    icon: "📦",
    color: "#6b7280",
    type: "expense",
    children: [],
  },
  // INCOME categories
  {
    name: "Salário",
    icon: "💼",
    color: "#22c55e",
    type: "income",
    children: [
      { name: "Salário Fixo", icon: "💼", color: "#22c55e", type: "income" },
      { name: "13º Salário", icon: "🎁", color: "#22c55e", type: "income" },
      { name: "Férias", icon: "🏖️", color: "#22c55e", type: "income" },
      { name: "Hora Extra", icon: "⏰", color: "#22c55e", type: "income" },
    ],
  },
  {
    name: "Renda Extra",
    icon: "💡",
    color: "#10b981",
    type: "income",
    children: [
      { name: "Freelance", icon: "🖥️", color: "#10b981", type: "income" },
      { name: "Vendas", icon: "🛍️", color: "#10b981", type: "income" },
      { name: "Aluguel Recebido", icon: "🏠", color: "#10b981", type: "income" },
      { name: "Dividendos", icon: "📊", color: "#10b981", type: "income" },
    ],
  },
  {
    name: "Benefícios",
    icon: "🎯",
    color: "#14b8a6",
    type: "income",
    children: [
      { name: "Vale Refeição", icon: "🍽️", color: "#14b8a6", type: "income" },
      { name: "Vale Transporte", icon: "🚌", color: "#14b8a6", type: "income" },
      { name: "Bolsa/Auxílio", icon: "🎓", color: "#14b8a6", type: "income" },
    ],
  },
  {
    name: "Outras Receitas",
    icon: "💚",
    color: "#4ade80",
    type: "income",
    children: [],
  },
  // TRANSFER
  {
    name: "Transferência",
    icon: "↔️",
    color: "#94a3b8",
    type: "transfer",
    children: [
      { name: "Pagamento de Fatura de Cartão", icon: "💳", color: "#94a3b8", type: "transfer" },
    ],
  },
];

async function seed() {
  console.log("Seeding database...");

  for (const cat of systemCategories) {
    const { children, ...parentData } = cat;

    const parent = await db.category.upsert({
      where: {
        id: `system_${cat.name.toLowerCase().replace(/\s+/g, "_")}`,
      },
      create: {
        id: `system_${cat.name.toLowerCase().replace(/\s+/g, "_")}`,
        ...parentData,
        isSystem: true,
      },
      update: parentData,
    });

    for (const child of children) {
      await db.category.upsert({
        where: {
          id: `system_${parent.name.toLowerCase().replace(/\s+/g, "_")}_${child.name.toLowerCase().replace(/\s+/g, "_")}`,
        },
        create: {
          id: `system_${parent.name.toLowerCase().replace(/\s+/g, "_")}_${child.name.toLowerCase().replace(/\s+/g, "_")}`,
          ...child,
          parentId: parent.id,
          isSystem: true,
        },
        update: { ...child, parentId: parent.id },
      });
    }
  }

  console.log("Seed complete.");
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
