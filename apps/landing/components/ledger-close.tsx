"use client";

import { useEffect, useRef } from "react";

/**
 * O momento autoral da página: quando o extrato entra na tela, as linhas
 * assentam uma a uma e o grifo amarelo varre o saldo. Só arma se o extrato
 * ainda está abaixo da dobra e o movimento é permitido — sem JS, ou com
 * movimento reduzido, o extrato já aparece fechado.
 */
export function LedgerClose({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.85) return;

    el.classList.add("ledger-armed");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        el.classList.add("ledger-closed");
        el.classList.remove("ledger-armed");
        observer.disconnect();
      },
      { threshold: 0.35 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
