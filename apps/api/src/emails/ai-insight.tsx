import * as React from "react";

type Props = {
  name?: string;
  title?: string;
  body?: string;
};

const SEVERITY_COLORS: Record<string, string> = {
  success: "#16a34a",
  warning: "#f59e0b",
  critical: "#ef4444",
  info: "#6366f1",
};

export default function AiInsight({ name = "usuário", title = "Insight financeiro", body = "" }: Props) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "Arial, sans-serif", maxWidth: 600, margin: "0 auto", padding: 20 }}>
        <h1 style={{ color: SEVERITY_COLORS.info }}>💡 {title}</h1>
        <p>Olá, {name}!</p>
        <p>{body}</p>
      </body>
    </html>
  );
}
