import { View, Text } from "react-native";
import { scorePassword, type PasswordStrength } from "@finances/validations";

const LABEL: Record<PasswordStrength, string> = {
  "muito-fraca": "Muito fraca",
  fraca: "Fraca",
  media: "Média",
  forte: "Forte",
};

const COLOR: Record<PasswordStrength, string> = {
  "muito-fraca": "bg-destructive dark:bg-destructive-dark",
  fraca: "bg-yellow-500",
  media: "bg-yellow-500",
  forte: "bg-green-500",
};

export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;

  const { score, strength } = scorePassword(password);
  const bars = [0, 1, 2, 3];

  return (
    <View className="mt-1.5 flex-row items-center gap-2">
      <View className="flex-1 flex-row gap-1">
        {bars.map((i) => (
          <View key={i} className={`h-1 flex-1 rounded-full ${i < score ? COLOR[strength] : "bg-border dark:bg-border-dark"}`} />
        ))}
      </View>
      <Text className="text-xs text-muted-foreground dark:text-muted-foreground-dark">{LABEL[strength]}</Text>
    </View>
  );
}
