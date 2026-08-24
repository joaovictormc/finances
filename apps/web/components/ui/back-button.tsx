"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  /** Rota de destino ao voltar. Ex: "/groups", "/admin". */
  href: string;
  /** Texto opcional ao lado da seta (padrão: "Voltar"). */
  label?: string;
  className?: string;
}

/**
 * Botão de voltar pra telas internas (detalhe/sub-tela dentro de uma seção),
 * ex: /groups/[id] -> /groups, /admin/ai -> /admin. Usa Link com href fixo
 * (em vez de router.back()) pra sempre voltar pro mesmo lugar, mesmo se o
 * usuário chegou na tela por um link direto/refresh, sem histórico de navegação.
 */
export function BackButton({ href, label = "Voltar", className }: BackButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3",
        className
      )}
    >
      <ArrowLeft size={16} />
      {label}
    </Link>
  );
}
