import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

// Caminho relativo: passa pelo mesmo proxy same-origin de api-client.ts (ver
// next.config.ts) — funciona igual em LAN, Tailscale ou domínio.
export const authClient = createAuthClient({
  baseURL: "/api/auth",
  plugins: [twoFactorClient()],
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
