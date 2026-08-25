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

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function IconBadge({ icon, color, size = "md" }: IconBadgeProps) {
  const { box, text } = SIZES[size];
  const isHexColor = !!color && HEX_COLOR.test(color);

  return (
    <View
      style={{
        width: box,
        height: box,
        borderRadius: box / 2,
        // Fundo suave na cor da categoria (elemento emprestado do kit
        // finance-application-for-sketch, ver docs/ajustes-pos-teste.md) —
        // "1A" é ~10% de opacidade em hex. Sem hex válido, cai no fundo
        // neutro de sempre (bg-card via className).
        backgroundColor: isHexColor ? `${color}1A` : undefined,
      }}
      className={isHexColor ? "items-center justify-center shrink-0" : "items-center justify-center bg-card border border-border dark:bg-card-dark dark:border-border-dark shrink-0"}
    >
      <Text style={{ fontSize: text, color: color ?? undefined }}>{icon ?? "•"}</Text>
    </View>
  );
}
