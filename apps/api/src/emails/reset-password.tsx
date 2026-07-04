import * as React from "react";

type Props = {
  name?: string;
  url?: string;
};

export default function ResetPassword({ name = "usuário", url = "#" }: Props) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "Arial, sans-serif", maxWidth: 600, margin: "0 auto", padding: 20 }}>
        <h1 style={{ color: "#111" }}>Redefinir senha</h1>
        <p>Olá, {name}!</p>
        <p>
          Recebemos um pedido para redefinir a senha da sua conta no ControlAI. Clique no botão
          abaixo para escolher uma nova senha:
        </p>
        <a
          href={url}
          style={{
            display: "inline-block",
            backgroundColor: "#111",
            color: "#fff",
            padding: "12px 24px",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: "bold",
          }}
        >
          Redefinir senha
        </a>
        <p style={{ color: "#6b7280", fontSize: 13, marginTop: 24 }}>
          Se você não pediu essa redefinição, ignore este e-mail — sua senha continua a mesma.
          Este link expira em 1 hora.
        </p>
      </body>
    </html>
  );
}
