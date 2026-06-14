import * as React from "react";

type Props = {
  name?: string;
  budgetName?: string;
  categoryName?: string;
  percentUsed?: number;
  spent?: string;
  limit?: string;
};

export default function BudgetAlert({
  name = "usuário",
  budgetName = "orçamento",
  categoryName = "categoria",
  percentUsed = 80,
  spent = "R$ 0,00",
  limit = "R$ 0,00",
}: Props) {
  const isOver = percentUsed >= 100;

  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "Arial, sans-serif", maxWidth: 600, margin: "0 auto", padding: 20 }}>
        <h1 style={{ color: isOver ? "#ef4444" : "#f59e0b" }}>
          {isOver ? "🔴 Orçamento estourado!" : "⚠️ Orçamento próximo do limite"}
        </h1>
        <p>Olá, {name}!</p>
        <p>
          Seu orçamento <strong>{budgetName}</strong> ({categoryName}) atingiu{" "}
          <strong>{percentUsed}%</strong> do limite.
        </p>
        <ul>
          <li>Gasto até agora: <strong>{spent}</strong></li>
          <li>Limite: <strong>{limit}</strong></li>
        </ul>
        {isOver && <p style={{ color: "#ef4444", fontWeight: "bold" }}>Você ultrapassou o limite do orçamento!</p>}
      </body>
    </html>
  );
}
