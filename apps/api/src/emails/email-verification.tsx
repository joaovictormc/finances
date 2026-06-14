import * as React from "react";

type Props = {
  name?: string;
  url?: string;
};

export default function EmailVerification({ name = "usuário", url = "#" }: Props) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "Arial, sans-serif", maxWidth: 600, margin: "0 auto", padding: 20 }}>
        <h1 style={{ color: "#111" }}>Confirme seu e-mail</h1>
        <p>Olá, {name}!</p>
        <p>Clique no botão abaixo para confirmar seu e-mail e ativar sua conta no Financeiro:</p>
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
          Confirmar e-mail
        </a>
        <p style={{ color: "#6b7280", fontSize: 13, marginTop: 24 }}>
          Se você não criou uma conta, ignore este e-mail.
        </p>
      </body>
    </html>
  );
}
