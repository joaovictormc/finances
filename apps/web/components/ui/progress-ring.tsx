import { cn } from "@/lib/utils";

interface ProgressRingProps {
  /** 0 a 1. */
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string | null;
  showLabel?: boolean;
  className?: string;
  children?: React.ReactNode;
}

// Anel de progresso em SVG puro (sem lib de gráfico) — mesma matemática de
// stroke-dasharray/stroke-dashoffset usada na versão mobile
// (apps/mobile/components/progress-ring.tsx via react-native-svg), pra manter
// os dois visualmente idênticos. Ver docs/ajustes-pos-teste.md, "Layout e
// design" — elemento emprestado do kit finance-application-for-sketch.
export function ProgressRing({
  value,
  size = 40,
  strokeWidth = 4,
  color,
  showLabel = false,
  className,
  children,
}: ProgressRingProps) {
  const pct = Math.min(Math.max(value, 0), 1);
  const colorClass = pct >= 1 ? "stroke-destructive" : pct >= 0.8 ? "stroke-warning" : "stroke-success";

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  const center = size / 2;

  return (
    <div className={cn("relative inline-flex items-center justify-center shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={center} cy={center} r={radius} strokeWidth={strokeWidth} className="stroke-muted" fill="none" />
        <circle
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          className={cn("transition-[stroke-dashoffset] duration-500", !color && colorClass)}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
            ...(color ? { stroke: color } : {}),
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children ?? (showLabel && <span className="text-[10px] font-semibold tabular-nums text-foreground">{Math.round(pct * 100)}%</span>)}
      </div>
    </div>
  );
}
