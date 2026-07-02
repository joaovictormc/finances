import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";
const isWeb = Platform.OS === "web";

// No app nativo o fetch não manda o header `Origin`, então o Better Auth rejeita
// com "missing or null origin". Enviamos manualmente a origem da API (que está em
// trustedOrigins no servidor). No web o navegador controla o `Origin` sozinho —
// e ignora qualquer valor que tentarmos definir —, então só fazemos isso no nativo.
const nativeHeaders = isWeb ? undefined : { Origin: new URL(API_URL).origin };

export const authClient = createAuthClient({
  baseURL: `${API_URL}/api/auth`,
  fetchOptions: {
    headers: nativeHeaders,
    // Na web a sessão vive em cookie de verdade guardado pelo navegador, que só
    // é enviado em requests cross-origin (porta 8081 -> 3001) com `credentials: include`.
    credentials: isWeb ? "include" : undefined,
  },
  plugins: isWeb
    ? []
    : [
        // expo-secure-store não tem implementação real na web (o módulo web
        // exporta um objeto vazio), então esse plugin — que persiste o cookie
        // de sessão nele — só pode rodar no nativo. Na web isso falhava
        // silenciosamente e a sessão nunca era salva após o login.
        expoClient({
          scheme: "controlai",
          storagePrefix: "controlai",
          storage: SecureStore,
        }),
      ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
