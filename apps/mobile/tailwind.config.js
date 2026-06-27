// Paleta convertida de apps/web/app/globals.css (OKLCH → hex aproximado).
// NativeWind não lê variáveis CSS OKLCH nem `.dark` por classe — o tema
// escuro é selecionado via `darkMode: "class"` + provider do NativeWind.
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Paleta "Finans" (layouts/Finans - Finance Mobile App):
      // primary = amarelo de marca, navy para texto/superfícies escuras.
      colors: {
        background: { DEFAULT: "#fafafa", dark: "#0f0f12" },
        foreground: { DEFAULT: "#14142B", dark: "#ededed" },
        card: { DEFAULT: "#ffffff", dark: "#1a1a1e" },
        muted: { DEFAULT: "#f1f1f3", dark: "#262629" },
        "muted-foreground": { DEFAULT: "#71717a", dark: "#a1a1aa" },
        border: { DEFAULT: "#e4e4e7", dark: "#2e2e33" },
        primary: { DEFAULT: "#FEDC33", dark: "#FEDC33" },
        "primary-foreground": { DEFAULT: "#14142B", dark: "#14142B" },
        navy: { DEFAULT: "#14142B", dark: "#ededed" },
        "tab-inactive": { DEFAULT: "#95A4B7", dark: "#6b7787" },
        destructive: { DEFAULT: "#ef4444", dark: "#f87171" },
      },
    },
  },
  plugins: [],
};
