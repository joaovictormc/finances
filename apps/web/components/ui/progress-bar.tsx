import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  className?: string;
  showLabel?: boolean;
  color?: string | null;
  trackClassName?: string;
}

export function ProgressBar({ value, className, showLabel = false, color, trackClassName }: ProgressBarProps) {
  const pct = Math.min(Math.max(value, 0), 1);
  const colorClass =
    pct >= 1
      ? "bg-destructive"
      : pct >= 0.8
        ? "bg-warning"
        : "bg-success";

  return (
    <div className={cn("w-full", className)}>
      <div className={cn("h-2.5 w-full rounded-full bg-muted overflow-hidden", trackClassName)}>
        <div
          className={cn("h-full rounded-full transition-all duration-300", !color && colorClass)}
          style={{ width: `${pct * 100}%`, ...(color ? { backgroundColor: color } : {}) }}
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
