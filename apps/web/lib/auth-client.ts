import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

// Better Auth exige uma URL absoluta também durante o prerender do Next.js.
// No navegador usamos a origem efetivamente acessada (LAN, Tailscale ou
// domínio); no servidor, a URL pública configurada serve apenas para montar o
// cliente durante SSR/build.
const appOrigin =
  typeof window === "undefined"
    ? (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
    : window.location.origin;

export const authClient = createAuthClient({
  baseURL: `${appOrigin}/api/auth`,
  plugins: [twoFactorClient()],
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
