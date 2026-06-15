import { cn } from "@/lib/utils";

type BadgeVariant = "income" | "expense" | "transfer" | "success" | "warning" | "destructive" | "default";

const variantClasses: Record<BadgeVariant, string> = {
  income: "bg-success/15 text-success border-success/30",
  expense: "bg-destructive/15 text-destructive border-destructive/30",
  transfer: "bg-primary/15 text-primary border-primary/30",
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  destructive: "bg-destructive/15 text-destructive border-destructive/30",
  default: "bg-muted text-muted-foreground border-border",
};

const labels: Partial<Record<BadgeVariant, string>> = {
  income: "Receita",
  expense: "Gasto",
  transfer: "Transferência",
};

interface BadgeProps {
  variant?: BadgeVariant;
  children?: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
    >
      {children ?? labels[variant]}
    </span>
  );
}
