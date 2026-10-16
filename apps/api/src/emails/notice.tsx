import * as React from "react";

type Props = {
  name?: string;
  title?: string;
  body?: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

/** Aviso genérico com botão (assinatura vencendo, cobrança recusada, metas). */
export default function Notice({ name = "", title = "Aviso do ControlAI", body = "", ctaLabel, ctaUrl }: Props) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "Arial, sans-serif", maxWidth: 600, margin: "0 auto", padding: 20, color: "#1c1c1e" }}>
        <h1 style={{ fontSize: 22 }}>{title}</h1>
        {name && <p>Olá, {name}!</p>}
        <p style={{ lineHeight: 1.6 }}>{body}</p>
        {ctaLabel && ctaUrl && (
          <p style={{ marginTop: 24 }}>
            <a
              href={ctaUrl}
              style={{ background: "#FFC300", color: "#1c1c1e", padding: "12px 20px", borderRadius: 10, fontWeight: 600, textDecoration: "none" }}
            >
              {ctaLabel}
            </a>
          </p>
        )}
      </body>
    </html>
  );
}
