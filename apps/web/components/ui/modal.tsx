"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

// Tela flutuante centralizada com fundo desfocado — substitui o Drawer lateral
// nos fluxos de "nova/novo X" (ver docs/ajustes-pos-teste.md). Mesma API do
// Drawer (open/onClose/title/children/className) pra troca direta nos callers.
export function Modal({ open, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop desfocado */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-background/70 backdrop-blur-sm transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Painel centralizado */}
      <div
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center p-4",
          open ? "" : "pointer-events-none"
        )}
      >
        <div
          className={cn(
            "w-full max-w-lg max-h-[85vh] rounded-lg border border-border bg-card shadow-lg",
            "flex flex-col transition-all duration-200",
            open ? "opacity-100 scale-100" : "opacity-0 scale-95",
            className
          )}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">{children}</div>
        </div>
      </div>
    </>
  );
}
