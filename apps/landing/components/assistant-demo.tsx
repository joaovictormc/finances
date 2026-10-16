"use client";

import { useEffect, useRef, useState } from "react";
import { SendIcon } from "./icons";

type Exchange = { question: string; answer: string };

/**
 * Quebra a resposta em texto e valores: "R$ 1.182,40" vira mono (como no
 * app) e "+ R$ ..." ganha o azul de saldo positivo. O admin escreve texto
 * normal no editor; a formatação sai daqui.
 */
const MONEY = /([+−-]?\s?R\$\s?\d{1,3}(?:\.\d{3})*,\d{2})/g;

function renderAnswer(answer: string) {
  return answer.split(MONEY).map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className={`money font-medium ${part.trim().startsWith("+") ? "text-azul" : ""}`}>
        {part.trim()}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

const TYPING_MS = 900;

export function AssistantDemo({
  exchanges,
  summaryLabel,
  summaryValue,
  demoLabel,
}: {
  exchanges: Exchange[];
  summaryLabel: string;
  summaryValue: string;
  demoLabel: string;
}) {
  const [active, setActive] = useState(0);
  const [typing, setTyping] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function ask(index: number) {
    if (index === active && !typing) return;
    if (timer.current) clearTimeout(timer.current);
    setActive(index);
    // Movimento reduzido: resposta na hora, sem o "digitando…".
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTyping(false);
      return;
    }
    setTyping(true);
    timer.current = setTimeout(() => setTyping(false), TYPING_MS);
  }

  const exchange = exchanges[Math.min(active, exchanges.length - 1)]!;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Celular desenhado: moldura grafite, tela de papel, a conversa do app. */}
      <div
        className="w-full max-w-[356px] rounded-[46px] bg-night p-[11px] shadow-[0_40px_80px_-36px_rgba(28,28,30,0.55),0_2px_6px_rgba(28,28,30,0.25)]"
        role="group"
        aria-label="Demonstração do assistente com dados de exemplo"
      >
        <div className="flex h-[580px] flex-col overflow-hidden rounded-[36px] bg-paper">
          <div className="flex items-center justify-between px-6 pb-3 pt-5">
            <span className="font-display text-[15px] font-bold">Assistente</span>
            <span className="rounded-full bg-paper-2 px-2.5 py-1 text-[11px] font-medium text-ink-3">Família Souza</span>
          </div>

          {/* Resumo do mês que o assistente tem em mãos ao responder. */}
          {(summaryLabel || summaryValue) && (
            <div className="mx-4 flex items-baseline justify-between gap-3 rounded-2xl border border-rule bg-white px-4 py-3">
              <span className="text-[12.5px] text-ink-3">{summaryLabel}</span>
              <span className={`money text-[17px] font-medium ${summaryValue.trim().startsWith("+") ? "text-azul" : ""}`}>
                {summaryValue}
              </span>
            </div>
          )}

          <div className="flex flex-1 flex-col justify-end gap-3 px-4 pb-3 pt-4" aria-live="polite">
            <p className="bubble-in self-end max-w-[86%] rounded-[18px] rounded-br-[6px] bg-night px-4 py-2.5 text-[14.5px] leading-snug text-night-ink" key={`q-${active}`}>
              {exchange.question}
            </p>

            {typing ? (
              <p className="bubble-in flex w-fit gap-1.5 rounded-[18px] rounded-bl-[6px] border border-rule bg-white px-4 py-3.5" aria-label="Assistente digitando">
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-ink-3" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-ink-3" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-ink-3" />
              </p>
            ) : (
              <p className="bubble-in max-w-[92%] rounded-[18px] rounded-bl-[6px] border border-rule bg-white px-4 py-3 text-[14.5px] leading-[1.55]" key={`a-${active}`}>
                {renderAnswer(exchange.answer)}
              </p>
            )}
          </div>

          {/* Sugestões, como no app: tocar numa delas faz a pergunta. */}
          <div className="flex flex-col gap-1.5 border-t border-rule px-4 pb-2 pt-3">
            <span className="px-1 text-[11.5px] font-medium text-ink-3">Toque numa pergunta</span>
            {exchanges.map((item, index) => {
              const selected = index === active;
              return (
                <button
                  key={item.question}
                  type="button"
                  onClick={() => ask(index)}
                  aria-pressed={selected}
                  className={`flex min-h-10 items-center justify-between gap-2 rounded-xl border px-3 text-left text-[13.5px] transition-colors duration-200 ${
                    selected ? "border-ink bg-white text-ink" : "border-rule bg-paper text-ink-2 hover:border-ink-3 hover:text-ink"
                  }`}
                >
                  <span>{item.question}</span>
                  <SendIcon size={13} className={selected ? "shrink-0 text-ink" : "shrink-0 text-ink-3"} />
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 px-4 pb-4 pt-2">
            <span className="flex-1 rounded-full bg-paper-2 px-4 py-2.5 text-[13px] text-ink-3">Pergunte em português…</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-night text-night-ink">
              <SendIcon size={15} />
            </span>
          </div>
        </div>
      </div>
      {demoLabel && <p className="text-[12.5px] text-ink-3">{demoLabel}</p>}
    </div>
  );
}
