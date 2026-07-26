import type { NextConfig } from "next";

// URL pra falar com a API server-side (rewrites abaixo + api-server.ts) — nunca
// exposta ao browser, então não precisa ser NEXT_PUBLIC_* nem bater com o
// endereço que o usuário digitou na barra do navegador. No Docker Compose
// (docker-compose.selfhosted.yml / docker-compose.yml) resolve pro container
// da API pelo nome do serviço (`http://api:3001`); em dev local sem Docker,
// cai no fallback de localhost.
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  // desligado: o double-effect do Strict Mode em dev destrói o iframe do
  // widget Pluggy Connect (baseado em zoid) assim que ele é montado,
  // deixando o botão "Conectar Banco" sem efeito visível e sem erro no console
  reactStrictMode: false,
  // necessário para o build gerar apps/web/.next/standalone/server.js,
  // usado pelo Dockerfile (ver docs/deploy.md Parte C.3)
  output: "standalone",
  // Proxy same-origin: o browser sempre chama /api/* no mesmo host:porta que
  // carregou a página (LAN, Tailscale, domínio — o que for), e o Next.js
  // encaminha pro container da API server-side. Evita expor a URL da API no
  // bundle do cliente e resolve o login travando quando o app é acessado por
  // um endereço diferente do que foi usado no build (ex: Tailscale).
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_INTERNAL_URL}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), geolocation=(), microphone=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
