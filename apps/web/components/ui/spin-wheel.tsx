"use client";

import { useEffect, useRef, useState } from "react";

export type WheelPrize = { label: string };

// Mesma paleta categórica do SpendingPieChart (apps/web/components/overview/spending-pie-chart.tsx).
const WHEEL_COLORS = [
  "#64748b", "#22c55e", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316", "#ec4899",
  "#84cc16", "#0ea5e9",
];

const SPIN_DURATION_MS = 4200;
const EXTRA_SPINS = 5;
// Desaceleração longa e monotônica (sem ultrapassar o alvo e voltar) — uma
// curva com overshoot fazia a roleta parecer travar e "pular" pro setor final
// perto do fim. Isso desacelera suave até parar, como uma roleta de verdade.
const SPIN_EASING = "cubic-bezier(0.12, 0.5, 0.14, 1)";

// Fase final de "acomodação": depois da desaceleração principal, um ajuste
// curto e suave (sem o balanço do ponteiro) puxa a roleta pro centro exato do
// prêmio mais próximo — como se o ponteiro estivesse se encaixando de vez.
const SETTLE_DURATION_MS = 420;
const SETTLE_EASING = "cubic-bezier(0.33, 1, 0.68, 1)";

interface SpinWheelProps {
  prizes: WheelPrize[];
  /** Índice em `prizes` do prêmio sorteado (sempre decidido no servidor). */
  targetIndex: number | null;
  /** Incrementa a cada novo giro pra forçar a animação mesmo se o índice repetir. */
  spinToken: number;
  onSpinEnd?: () => void;
  size?: number;
}

/** Roleta visual (SVG) — o sorteio em si nunca acontece aqui, só anima até o índice já decidido pelo backend. */
export function SpinWheel({ prizes, targetIndex, spinToken, onSpinEnd, size = 180 }: SpinWheelProps) {
  const [rotation, setRotation] = useState(0);
  const [phase, setPhase] = useState<"idle" | "spinning" | "settling">("idle");
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const lastToken = useRef(0);
  const settleTarget = useRef(0);

  useEffect(() => {
    if (targetIndex === null || prizes.length === 0) return;
    if (spinToken === lastToken.current) return;
    lastToken.current = spinToken;

    setHighlightIndex(null);
    setPhase("spinning");
    const segment = 360 / prizes.length;
    const centerAngle = targetIndex * segment + segment / 2;
    // A desaceleração principal para um pouco ANTES do centro exato (sempre
    // dentro do próprio setor vencedor — nunca passa pra vizinhança) — a fase
    // de acomodação completa o resto sempre girando pra frente, nunca volta.
    const settleSpread = segment * 0.3;
    const minOffset = Math.min(1.5, settleSpread / 2);
    const roughOffset = minOffset + Math.random() * (settleSpread - minOffset);
    const roughAngle = centerAngle + roughOffset;

    setRotation((prev) => {
      const prevMod = ((prev % 360) + 360) % 360;
      const delta = (((360 - roughAngle - prevMod) % 360) + 360) % 360;
      const roughRotation = prev + EXTRA_SPINS * 360 + delta;
      settleTarget.current = roughRotation + roughOffset;
      return roughRotation;
    });
  }, [targetIndex, spinToken, prizes.length]);

  if (prizes.length === 0) return null;

  const segment = 360 / prizes.length;

  function handleTransitionEnd() {
    if (phase === "spinning") {
      setPhase("settling");
      setRotation(settleTarget.current);
      return;
    }
    setPhase("idle");
    setHighlightIndex(targetIndex);
    onSpinEnd?.();
  }

  const transitionStyle =
    phase === "settling"
      ? `transform ${SETTLE_DURATION_MS}ms ${SETTLE_EASING}`
      : `transform ${SPIN_DURATION_MS}ms ${SPIN_EASING}`;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <style>{`
        @keyframes spin-wheel-pointer-wobble {
          0%, 100% { transform: translateX(-50%) rotate(0deg); }
          50% { transform: translateX(-50%) rotate(10deg); }
        }
        @keyframes spin-wheel-glow {
          0%, 100% { filter: drop-shadow(0 0 4px var(--color-primary)); }
          50% { filter: drop-shadow(0 0 14px var(--color-primary)); }
        }
      `}</style>
      <div
        className="absolute left-1/2 -top-1 z-10 -translate-x-1/2"
        style={{
          width: 0,
          height: 0,
          borderLeft: "7px solid transparent",
          borderRight: "7px solid transparent",
          borderTop: "12px solid var(--color-foreground)",
          transformOrigin: "50% 0%",
          // O balanço só acontece na desaceleração principal — a acomodação
          // final é uma "encaixada" suave, sem o ponteiro batendo mais.
          animation: phase === "spinning" ? "spin-wheel-pointer-wobble 0.11s ease-in-out infinite" : undefined,
        }}
      />
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: transitionStyle,
          animation: phase !== "idle" ? "spin-wheel-glow 0.5s ease-in-out infinite" : undefined,
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        <circle cx="100" cy="100" r="98" fill="var(--color-card)" stroke="var(--color-border)" strokeWidth="2" />
        {prizes.map((p, i) => {
          const start = i * segment;
          const end = start + segment;
          const midAngle = start + segment / 2;
          const labelPos = polarToCartesian(100, 100, 60, midAngle);
          const lines = wrapLabel(p.label, prizes.length);
          const lineHeight = 8.5;
          const isWinner = i === highlightIndex;
          return (
            <g key={i}>
              <path
                d={describeSlice(100, 100, 96, start, end)}
                fill={WHEEL_COLORS[i % WHEEL_COLORS.length]}
                stroke={isWinner ? "#fbbf24" : "var(--color-card)"}
                strokeWidth={isWinner ? 4 : 1.5}
              />
              {/* Texto sempre na vertical (sem rotação radial) — mais legível, e
                  quebrado em até 3 linhas centralizadas no espaço do setor. */}
              <text
                x={labelPos.x}
                y={labelPos.y}
                fill="#fff"
                stroke="rgba(0,0,0,0.35)"
                strokeWidth="2.5"
                paintOrder="stroke"
                fontSize="7.5"
                fontWeight="700"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {lines.map((line, li) => (
                  <tspan key={li} x={labelPos.x} dy={li === 0 ? -((lines.length - 1) * lineHeight) / 2 : lineHeight}>
                    {line}
                  </tspan>
                ))}
                <title>{p.label}</title>
              </text>
            </g>
          );
        })}
        <circle cx="100" cy="100" r="14" fill="var(--color-card)" stroke="var(--color-border)" strokeWidth="2" />
      </svg>
    </div>
  );
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeSlice(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const p1 = polarToCartesian(cx, cy, r, startAngle);
  const p2 = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`;
}

/** Quebra o rótulo em até 3 linhas curtas, pra ficar legível na vertical dentro do setor. */
function wrapLabel(label: string, sliceCount: number): string[] {
  const maxCharsPerLine = sliceCount <= 4 ? 11 : sliceCount <= 6 ? 8 : 6;
  const maxLines = 3;
  const words = label.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);

  const consumedLength = lines.join(" ").length;
  if (lines.length === maxLines && consumedLength < label.length) {
    const last = lines[maxLines - 1]!;
    lines[maxLines - 1] = last.length > 1 ? `${last.slice(0, -1)}…` : last;
  }

  return lines.map((line) => (line.length > maxCharsPerLine + 2 ? `${line.slice(0, maxCharsPerLine)}…` : line));
}
