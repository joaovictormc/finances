import { cn } from "@/lib/utils";

type SpinnerSize = "sm" | "md" | "lg";

const sizeClasses: Record<SpinnerSize, string> = {
  sm: "w-4 h-4 border-2",
  md: "w-6 h-6 border-2",
  lg: "w-8 h-8 border-[3px]",
};

export function Spinner({ size = "md", className }: { size?: SpinnerSize; className?: string }) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-current border-t-transparent",
        sizeClasses[size],
        className
      )}
    />
  );
}
