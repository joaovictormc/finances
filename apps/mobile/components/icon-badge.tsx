import { View, Text } from "react-native";

interface IconBadgeProps {
  icon?: string | null;
  color?: string | null;
  size?: "sm" | "md";
}

const SIZES = {
  sm: { box: 32, text: 14 },
  md: { box: 40, text: 18 },
};

export function IconBadge({ icon, color, size = "md" }: IconBadgeProps) {
  const { box, text } = SIZES[size];

  return (
    <View
      style={{ width: box, height: box, borderRadius: box / 2 }}
      className="items-center justify-center bg-white shrink-0"
    >
      <Text style={{ fontSize: text, color: color ?? undefined }}>{icon ?? "•"}</Text>
    </View>
  );
}
