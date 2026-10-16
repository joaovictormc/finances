import type { NextConfig } from "next";

// Servidor Next (não mais exportação estática): o conteúdo vem da API e cada
// página é regerada quando o admin publica (rota /api/revalidate), além de
// revalidar sozinha de hora em hora. Para o visitante continua sendo HTML
// pronto, com o mesmo SEO e velocidade de antes.
const nextConfig: NextConfig = {
  output: "standalone",
  images: { unoptimized: true },
};

export default nextConfig;
