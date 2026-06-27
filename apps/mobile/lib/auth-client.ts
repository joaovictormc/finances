import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

// No app nativo o fetch não manda o header `Origin`, então o Better Auth rejeita
// com "missing or null origin". Enviamos manualmente a origem da API (que está em
// trustedOrigins no servidor). No web o navegador controla o `Origin` sozinho —
// e ignora qualquer valor que tentarmos definir —, então só fazemos isso no nativo.
const nativeHeaders =
  Platform.OS === "web" ? undefined : { Origin: new URL(API_URL).origin };

export const authClient = createAuthClient({
  baseURL: `${API_URL}/api/auth`,
  fetchOptions: {
    headers: nativeHeaders,
  },
  plugins: [
    expoClient({
      scheme: "controlai",
      storagePrefix: "controlai",
      storage: SecureStore,
    }),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
