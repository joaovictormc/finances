import * as React from "react";

type Props = {
  name?: string;
};

export default function Welcome({ name = "usuário" }: Props) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "Arial, sans-serif", maxWidth: 600, margin: "0 auto", padding: 20 }}>
        <h1 style={{ color: "#111" }}>Bem-vindo ao ControlAI! 💰</h1>
        <p>Olá, {name}!</p>
        <p>Sua conta foi criada com sucesso. Agora você pode:</p>
        <ul>
          <li>Registrar gastos e receitas</li>
          <li>Conectar sua conta bancária via Open Finance</li>
          <li>Registrar gastos pelo Telegram com IA</li>
          <li>Criar orçamentos e metas financeiras</li>
        </ul>
        <p>Boas finanças! 🚀</p>
      </body>
    </html>
  );
}
