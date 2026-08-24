"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface ConfirmOptions {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

// Substitui window.confirm por um diálogo flutuante dentro do próprio app
// (ver docs/ajustes-pos-teste.md, "Tratamento de erros e alertas"). API por
// Promise<boolean> pra manter o mesmo formato de chamada dos call sites
// antigos: `if (!(await confirm("..."))) return;`.
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    const normalized = typeof opts === "string" ? { description: opts } : opts;
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOptions(normalized);
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  useEffect(() => {
    if (!options) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") settle(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [options, settle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      <div
        className={cn(
          "fixed inset-0 z-[60] bg-background/70 backdrop-blur-sm transition-opacity duration-200",
          options ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => settle(false)}
      />
      <div
        className={cn(
          "fixed inset-0 z-[70] flex items-center justify-center p-4",
          options ? "" : "pointer-events-none"
        )}
      >
        {options && (
          <div
            role="alertdialog"
            aria-modal="true"
            className={cn(
              "w-full max-w-sm rounded-lg border border-border bg-card shadow-lg p-6",
              "transition-all duration-200",
              "opacity-100 scale-100"
            )}
          >
            {options.title && (
              <h2 className="text-base font-semibold text-foreground mb-2">{options.title}</h2>
            )}
            <p className="text-sm text-muted-foreground mb-6">{options.description}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => settle(false)}>
                {options.cancelLabel ?? "Cancelar"}
              </Button>
              <Button
                variant={options.variant === "destructive" ? "destructive" : "default"}
                size="sm"
                onClick={() => settle(true)}
              >
                {options.confirmLabel ?? "Confirmar"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
