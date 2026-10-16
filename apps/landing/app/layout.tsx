import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// As mesmas famílias do app (apps/web): quem chega pela landing reconhece o
// produto em que vai entrar. next/font baixa no build e serve do próprio site.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-jakarta",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "ControlAI — o dinheiro da família, fechado no azul",
  description:
    "Transações, orçamentos, metas e contas a pagar da família num só lugar, com assistente de IA e cada lançamento assinado por quem fez. Comece grátis.",
  icons: {
    icon: [{ url: "/icons/logo.svg", type: "image/svg+xml" }],
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: "ControlAI — o dinheiro da família, fechado no azul",
    description: "Pergunte pro seu dinheiro. Ele responde. Finanças da família com IA, em português.",
    locale: "pt_BR",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#fafaf9",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${jakarta.variable} ${inter.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
