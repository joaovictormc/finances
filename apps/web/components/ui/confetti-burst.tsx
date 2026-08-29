"use client";

import { useMemo } from "react";

const PARTICLES = ["🎉", "✨", "🎊", "⭐"];
const PARTICLE_COUNT = 14;

/** Rajada de confete leve (só CSS, sem lib) — usada na revelação do prêmio da Roleta Semanal. */
export function ConfettiBurst() {
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        emoji: PARTICLES[i % PARTICLES.length],
        left: Math.random() * 100,
        delay: Math.random() * 0.25,
        duration: 1.1 + Math.random() * 0.6,
        drift: (Math.random() - 0.5) * 60,
        size: 14 + Math.random() * 10,
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      <style>{`
        @keyframes confetti-burst-fall {
          0% { transform: translate(0, -20px) rotate(0deg); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translate(var(--confetti-drift), 160px) rotate(340deg); opacity: 0; }
        }
      `}</style>
      {particles.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            top: 0,
            fontSize: p.size,
            // @ts-expect-error -- custom property lida pela keyframe acima
            "--confetti-drift": `${p.drift}px`,
            animation: `confetti-burst-fall ${p.duration}s ease-in ${p.delay}s forwards`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}
