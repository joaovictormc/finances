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

  return (
    <div
      className={cn(
        "flex items-center justify-center shrink-0 bg-card border border-border overflow-hidden",
        box,
        text,
        className
      )}
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
