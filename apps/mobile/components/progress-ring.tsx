import { View, Text } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "@/lib/theme";

interface ProgressRingProps {
  /** 0 a 1. */
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string | null;
  showLabel?: boolean;
  children?: React.ReactNode;
}

// Anel de progresso via react-native-svg — mesma matemática de
// strokeDasharray/strokeDashoffset da versão web
// (apps/web/components/ui/progress-ring.tsx), pra manter os dois visualmente
// idênticos. Ver docs/ajustes-pos-teste.md, "Layout e design" — elemento
// emprestado do kit finance-application-for-sketch.
export function ProgressRing({ value, size = 40, strokeWidth = 4, color, showLabel = false, children }: ProgressRingProps) {
  const { colors } = useTheme();
  const pct = Math.min(Math.max(value, 0), 1);
  const ringColor = color ?? (pct >= 1 ? colors.destructive : pct >= 0.8 ? "#F59E0B" : colors.success);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  const center = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={center} cy={center} r={radius} strokeWidth={strokeWidth} stroke={colors.border} fill="none" />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          stroke={ringColor}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </Svg>
      {children ?? (showLabel && (
        <Text className="text-[10px] font-semibold text-foreground dark:text-foreground-dark" style={{ fontVariant: ["tabular-nums"] }}>
          {Math.round(pct * 100)}%
        </Text>
      ))}
    </View>
  );
}
