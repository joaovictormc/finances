// Paleta convertida de apps/web/app/globals.css (OKLCH → hex aproximado),
// direção "Fechamento de Caixa" (ver apps/web/DESIGN.md).
// NativeWind não lê variáveis CSS OKLCH nem `.dark` por classe — o tema
// escuro é selecionado via `darkMode: "class"` + provider do NativeWind.
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Base neutra grafite/papel; azul/vermelho reservados para status
      // financeiro ("no azul"/"no vermelho"); amarelo-marcador como única
      // cor de assinatura, usada com raridade (The One Marker Rule).
      colors: {
        background: { DEFAULT: "#FAFAF9", dark: "#1C1C1E" },
        foreground: { DEFAULT: "#1C1C1E", dark: "#F5F5F3" },
        card: { DEFAULT: "#FDFDFC", dark: "#232326" },
        muted: { DEFAULT: "#EDEDEA", dark: "#2A2A2E" },
        "muted-foreground": { DEFAULT: "#6B6B70", dark: "#9E9EA3" },
        border: { DEFAULT: "#D6D5D0", dark: "#38383D" },
        primary: { DEFAULT: "#FFC300", dark: "#FFC300" },
        "primary-foreground": { DEFAULT: "#1C1C1E", dark: "#1C1C1E" },
        navy: { DEFAULT: "#1C1C1E", dark: "#F5F5F3" },
        "tab-inactive": { DEFAULT: "#A6A5A0", dark: "#6E6E73" },
        destructive: { DEFAULT: "#DC2626", dark: "#F87171" },
        // "success" mapeia pro azul-no-azul (status positivo) — mesmo
        // significado do idiomatismo usado no web, não é mais verde.
        success: { DEFAULT: "#2563EB", dark: "#60A5FA" },
      },
    },
  },
  plugins: [],
};
