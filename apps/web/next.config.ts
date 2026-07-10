import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // desligado: o double-effect do Strict Mode em dev destrói o iframe do
  // widget Pluggy Connect (baseado em zoid) assim que ele é montado,
  // deixando o botão "Conectar Banco" sem efeito visível e sem erro no console
  reactStrictMode: false,
  // necessário para o build gerar apps/web/.next/standalone/server.js,
  // usado pelo Dockerfile (ver docs/deploy.md Parte C.3)
  output: "standalone",
};

export default nextConfig;
