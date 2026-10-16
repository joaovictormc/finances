"use client";

import { useEffect, useState } from "react";
import { SIGNUP_URL } from "@/lib/links";

/**
 * O amarelo-marcador é de um elemento por tela. No topo ele é deste botão;
 * passando do hero, o botão vira grafite e cede o amarelo para o que cada
 * seção grifa (o saldo "no azul", o plano Família, a chamada final).
 */
export function HeaderCta() {
  const [atTop, setAtTop] = useState(true);

  useEffect(() => {
    const hero = document.getElementById("topo");
    if (!hero) return;
    const observer = new IntersectionObserver(([entry]) => setAtTop(entry?.isIntersecting ?? true), {
      // Troca quando o hero sai por baixo do cabeçalho fixo.
      rootMargin: "-72px 0px 0px 0px",
    });
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <a
      href={SIGNUP_URL}
      className={`rounded-[10px] px-4 py-2.5 text-[15px] font-semibold transition-[background-color,color,transform,box-shadow] duration-300 hover:-translate-y-px ${
        atTop
          ? "bg-marker text-ink shadow-[0_1px_0_rgba(28,28,30,0.18)] hover:shadow-[0_6px_16px_-8px_rgba(28,28,30,0.45)]"
          : "bg-ink text-paper hover:shadow-[0_6px_16px_-8px_rgba(28,28,30,0.6)]"
      }`}
    >
      <span className="whitespace-nowrap">
        Criar conta<span className="hidden sm:inline"> grátis</span>
      </span>
    </a>
  );
}
