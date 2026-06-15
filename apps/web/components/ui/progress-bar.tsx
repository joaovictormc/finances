import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  className?: string;
  showLabel?: boolean;
}

export function ProgressBar({ value, className, showLabel = false }: ProgressBarProps) {
  const pct = Math.min(Math.max(value, 0), 1);
  const colorClass =
    pct >= 1
      ? "bg-destructive"
      : pct >= 0.8
        ? "bg-warning"
        : "bg-success";

  return (
    <div className={cn("w-full", className)}>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-300", colorClass)}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      {showLabel && (
        <p className="mt-1 text-xs text-muted-foreground text-right">
          {Math.round(pct * 100)}%
        </p>
      )}
    </div>
  );
}
