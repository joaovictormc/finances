"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/app/providers/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
      className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
