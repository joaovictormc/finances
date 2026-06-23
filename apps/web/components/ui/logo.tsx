interface LogoProps {
  variant?: "icon" | "full";
  size?: number;
  className?: string;
}

export function Logo({ variant = "full", size = 28, className }: LogoProps) {
  const icon = (
    <svg width={size} height={size} viewBox="0 0 96 96" className="shrink-0">
      <rect width="96" height="96" rx="22" fill="#6366f1" />
      <path
        d="M24 66 L42 50 L54 59 L72 28"
        fill="none"
        stroke="#ffffff"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="72" cy="28" r="8" fill="#ffffff" />
    </svg>
  );

  if (variant === "icon") {
    return <span className={className}>{icon}</span>;
  }

  return (
    <span className={`flex items-center gap-2 font-bold tracking-tight ${className ?? ""}`}>
      {icon}
      <span className="text-foreground">
        Control<span className="text-primary">AI</span>
      </span>
    </span>
  );
}
