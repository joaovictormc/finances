import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export const authClient = createAuthClient({
  baseURL: `${API_URL}/api/auth`,
  plugins: [
    expoClient({
      scheme: "controlai",
      storagePrefix: "controlai",
      storage: SecureStore,
    }),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
