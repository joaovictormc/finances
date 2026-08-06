import { View } from "react-native";
import { useTheme } from "@/lib/theme";

interface ProgressBarProps {
  /** Valor de 0 a 1. */
  value: number;
  color?: string | null;
}

export function ProgressBar({ value, color }: ProgressBarProps) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(1, value)) * 100;

  return (
    <View className="h-2 w-full overflow-hidden rounded-full bg-muted dark:bg-muted-dark">
      <View
        style={{ width: `${pct}%`, backgroundColor: color ?? colors.mutedForeground }}
        className="h-full rounded-full"
      />
    </View>
  );
}
