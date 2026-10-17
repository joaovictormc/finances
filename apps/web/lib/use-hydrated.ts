"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * `false` no servidor e durante a hidratação, `true` depois. Para o que só o
 * navegador sabe (plano e sessão carregados por fetch): a hidratação pode
 * acontecer depois que a resposta chegou, e desenhar com ela ali diverge do
 * HTML do servidor (erro de hydration mismatch).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}
