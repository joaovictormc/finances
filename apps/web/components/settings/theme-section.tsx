"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type ThemePreference } from "@/app/providers/theme-provider";

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

export function ThemeSection() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-3">
      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            theme === value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "border border-border text-muted-foreground hover:bg-accent"
          }`}
        >
          <Icon size={16} />
          {label}
        </button>
      ))}
    </div>
  );
}
