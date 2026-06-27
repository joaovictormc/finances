import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";

// Container base das telas: aplica safe-area e limita a largura do conteúdo em
// telas grandes (tablet/web), centralizando — deixa o layout adaptável a
// qualquer dispositivo sem cada tela repetir essa lógica.
const MAX_CONTENT_WIDTH = 600;

type Edge = "top" | "bottom";

export function Screen({
  children,
  edges = ["top"],
}: {
  children: ReactNode;
  edges?: Edge[];
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: edges.includes("top") ? insets.top : 0,
        paddingBottom: edges.includes("bottom") ? insets.bottom : 0,
      }}
    >
      <View style={{ flex: 1, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }}>
        {children}
      </View>
    </View>
  );
}
