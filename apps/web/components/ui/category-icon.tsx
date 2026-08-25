import { cn } from "@/lib/utils";

const SIZES = {
  sm: { box: "w-8 h-8 rounded-lg", text: "text-sm" },
  md: { box: "w-10 h-10 rounded-xl", text: "text-lg" },
  lg: { box: "w-12 h-12 rounded-xl", text: "text-2xl" },
} as const;

interface CategoryIconProps {
  icon?: string | null;
  iconUrl?: string | null;
  color?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}

export function CategoryIcon({ icon, iconUrl, color, size = "md", className }: CategoryIconProps) {
  const { box, text } = SIZES[size];
  const isHexColor = !!color && /^#[0-9a-fA-F]{6}$/.test(color);

  return (
    <div
      className={cn(
        "flex items-center justify-center shrink-0 overflow-hidden",
        !isHexColor && "bg-card border border-border",
        box,
        text,
        className
      )}
      // Fundo suave na cor da categoria (elemento emprestado do kit
      // finance-application-for-sketch, ver docs/ajustes-pos-teste.md) —
      // "1A" é ~10% de opacidade em hex, mantém contraste em claro e escuro.
      // Só aplica se `color` for um hex de 6 dígitos válido; formatos
      // desconhecidos (nome CSS, rgb(), etc.) caem no fundo neutro de sempre.
      style={isHexColor ? { backgroundColor: `${color}1A` } : undefined}
    >
      {iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={iconUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <span style={color ? { color } : undefined}>{icon ?? "•"}</span>
      )}
    </div>
  );
}
