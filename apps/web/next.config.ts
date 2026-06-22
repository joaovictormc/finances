import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // desligado: o double-effect do Strict Mode em dev destrói o iframe do
  // widget Pluggy Connect (baseado em zoid) assim que ele é montado,
  // deixando o botão "Conectar Banco" sem efeito visível e sem erro no console
  reactStrictMode: false,
};

export default nextConfig;
