import * as React from "react";

type Props = {
  name?: string;
  billName?: string;
  amount?: string;
  daysUntilDue?: number;
  dueDate?: string;
};

export default function BillReminder({
  name = "usuário",
  billName = "conta",
  amount = "R$ 0,00",
  daysUntilDue = 1,
  dueDate = "",
}: Props) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "Arial, sans-serif", maxWidth: 600, margin: "0 auto", padding: 20 }}>
        <h1 style={{ color: "#f59e0b" }}>⚠️ Lembrete de conta</h1>
        <p>Olá, {name}!</p>
        <p>
          Sua conta <strong>{billName}</strong> no valor de <strong>{amount}</strong> vence em{" "}
          <strong>{daysUntilDue} {daysUntilDue === 1 ? "dia" : "dias"}</strong>
          {dueDate ? ` (${dueDate})` : ""}.
        </p>
        <p style={{ color: "#6b7280", fontSize: 13 }}>
          Acesse o app para mais detalhes.
        </p>
      </body>
    </html>
  );
}
