import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "nativewind";
import * as SecureStore from "expo-secure-store";

// Preferência de tema escolhida pelo usuário. "system" segue o tema do aparelho.
export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "controlai.theme";

// Cores semânticas que precisam ser passadas como prop (placeholders, headers
// nativos, status bar) — onde não dá pra usar classe do NativeWind.
export type ThemeColors = {
  background: string;
  card: string;
  foreground: string;
  mutedForeground: string;
  border: string;
  // Paleta "Finans": amarelo de marca + cinza-azulado de item inativo.
  primary: string;
  tabInactive: string;
  // Cores semânticas de receita/gasto (gráficos, ícones) — mesmos valores
  // do tailwind.config.js (success/destructive), pra não hardcodar hex
  // repetido em cada tela que precisa passar cor pra um prop nativo.
  success: string;
  destructive: string;
};

export const THEME_COLORS: Record<"light" | "dark", ThemeColors> = {
  light: {
    background: "#fafafa",
    card: "#ffffff",
    foreground: "#14142B",
    mutedForeground: "#71717a",
    border: "#e4e4e7",
    primary: "#FEDC33",
    tabInactive: "#95A4B7",
    success: "#22c55e",
    destructive: "#ef4444",
  },
  dark: {
    background: "#0f0f12",
    card: "#1a1a1e",
    foreground: "#ededed",
    mutedForeground: "#a1a1aa",
    border: "#2e2e33",
    primary: "#FEDC33",
    tabInactive: "#6b7787",
    success: "#4ade80",
    destructive: "#f87171",
  },
};

type ThemeContextValue = {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  // Tema concreto em uso ("light" | "dark"), já resolvido a partir da preferência.
  scheme: "light" | "dark";
  colors: ThemeColors;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  // Carrega a preferência salva ao iniciar e aplica no NativeWind.
  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((val) => {
        const pref: ThemePreference =
          val === "light" || val === "dark" || val === "system" ? val : "system";
        setPreferenceState(pref);
        setColorScheme(pref);
      })
      .catch(() => setColorScheme("system"));
  }, [setColorScheme]);

  const setPreference = useCallback(
    (p: ThemePreference) => {
      setPreferenceState(p);
      setColorScheme(p);
      void SecureStore.setItemAsync(STORAGE_KEY, p);
    },
    [setColorScheme]
  );

  const scheme: "light" | "dark" = colorScheme === "dark" ? "dark" : "light";

  return (
    <ThemeContext.Provider
      value={{ preference, setPreference, scheme, colors: THEME_COLORS[scheme] }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme precisa estar dentro de <ThemeProvider>.");
  return ctx;
}
