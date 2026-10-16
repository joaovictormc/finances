import type { LandingBlockData } from "@finances/validations";
import { kern } from "./kern";
import type { BlockContext } from "./block-context";

type Node = { kind: "p"; text: string } | { kind: "h"; text: string } | { kind: "ul"; items: string[] };

/**
 * Marcação mínima do editor, interpretada aqui em elementos React (nunca
 * HTML cru): parágrafos separados por linha em branco, "## " vira subtítulo,
 * linhas com "- " viram lista.
 */
function parse(body: string): Node[] {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk): Node => {
      if (chunk.startsWith("## ")) return { kind: "h", text: chunk.slice(3).trim() };
      const lines = chunk.split("\n").map((l) => l.trim());
      if (lines.every((l) => l.startsWith("- "))) return { kind: "ul", items: lines.map((l) => l.slice(2).trim()) };
      return { kind: "p", text: lines.join(" ") };
    });
}

export function TextBlock({ data, anchor, ctx }: { data: LandingBlockData<"text">; anchor?: string; ctx: BlockContext }) {
  const Heading = ctx.headingLevel === 1 ? "h1" : "h2";
  const Sub = ctx.headingLevel === 1 && data.title ? "h2" : "h3";
  return (
    <section id={anchor || undefined} className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 md:py-24">
      <div className="max-w-[68ch]">
        {data.title && (
          <Heading className="mb-10 font-display text-[clamp(34px,4.4vw,52px)] font-extrabold leading-[1.05] tracking-[-0.025em] text-balance">
            {kern(data.title)}
          </Heading>
        )}
        <div className="flex flex-col gap-5 text-[17px] leading-[1.7] text-ink-2">
          {parse(data.body).map((node, i) => {
            if (node.kind === "h")
              return (
                <Sub key={i} className="mt-6 font-display text-[22px] font-bold leading-snug tracking-[-0.01em] text-ink first:mt-0">
                  {node.text}
                </Sub>
              );
            if (node.kind === "ul")
              return (
                <ul key={i} className="flex flex-col gap-2 border-l border-rule pl-5">
                  {node.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              );
            return <p key={i}>{node.text}</p>;
          })}
        </div>
      </div>
    </section>
  );
}
