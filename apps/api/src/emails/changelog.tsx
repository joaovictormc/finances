import * as React from "react";
import type { ChangelogItem, ChangelogItemKind } from "@finances/validations";

type Props = {
  name?: string;
  title?: string;
  version?: string;
  items?: ChangelogItem[];
  ctaUrl?: string;
};

const SECTIONS: { kind: ChangelogItemKind; heading: string }[] = [
  { kind: "new", heading: "Novidades" },
  { kind: "improvement", heading: "Melhorias" },
  { kind: "fix", heading: "Correções" },
];

/** Novidade publicada em Admin › Novidades: itens agrupados por tipo. */
export default function Changelog({ name = "", title = "Novidades do ControlAI", version, items = [], ctaUrl }: Props) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "Arial, sans-serif", maxWidth: 600, margin: "0 auto", padding: 20, color: "#1c1c1e" }}>
        <p style={{ fontSize: 13, color: "#5b5b60", margin: 0 }}>
          ControlAI{version ? ` · versão ${version}` : ""}
        </p>
        <h1 style={{ fontSize: 22, marginTop: 6 }}>{title}</h1>
        {name && <p>Olá, {name}! Atualizamos o app. Veja o que mudou:</p>}
        {SECTIONS.map(({ kind, heading }) => {
          const list = items.filter((item) => item.kind === kind);
          if (list.length === 0) return null;
          return (
            <div key={kind}>
              <h2 style={{ fontSize: 16, marginBottom: 6 }}>{heading}</h2>
              <ul style={{ lineHeight: 1.6, paddingLeft: 20, marginTop: 0 }}>
                {list.map((item, index) => (
                  <li key={index}>{item.text}</li>
                ))}
              </ul>
            </div>
          );
        })}
        {ctaUrl && (
          <p style={{ marginTop: 24 }}>
            <a
              href={ctaUrl}
              style={{ background: "#FFC300", color: "#1c1c1e", padding: "12px 20px", borderRadius: 10, fontWeight: 600, textDecoration: "none" }}
            >
              Ver no app
            </a>
          </p>
        )}
        <p style={{ fontSize: 12, color: "#5b5b60", marginTop: 32 }}>
          Para não receber estes avisos por e-mail, desligue os avisos por e-mail em Configurações.
        </p>
      </body>
    </html>
  );
}
