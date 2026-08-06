interface LogoProps {
  variant?: "icon" | "full";
  size?: number;
  className?: string;
}

export function Logo({ variant = "full", size = 28, className }: LogoProps) {
  // Marca "Fechamento de Caixa" (ver DESIGN.md): o ícone é o único lugar
  // onde o amarelo-marcador aparece sempre — a assinatura da marca, não um
  // acento espalhado. O restante do wordmark fica neutro (foreground) para
  // não competir com ele (The One Marker Rule).
  const icon = (
    <svg width={size} height={size} viewBox="0 0 96 96" className="shrink-0">
      <rect width="96" height="96" rx="18" className="fill-primary" />
      <path
        d="M24 66 L42 50 L54 59 L72 28"
        fill="none"
        className="stroke-primary-foreground"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="72" cy="28" r="8" className="fill-primary-foreground" />
    </svg>
  );

  if (variant === "icon") {
    return <span className={className}>{icon}</span>;
  }

  return (
    <span className={`flex items-center gap-2 font-display font-bold tracking-tight ${className ?? ""}`}>
      {icon}
      <span className="text-foreground">ControlAI</span>
    </span>
  );
}
