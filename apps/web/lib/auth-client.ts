import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const authClient = createAuthClient({
  baseURL: `${API_URL}/api/auth`,
  plugins: [twoFactorClient()],
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
