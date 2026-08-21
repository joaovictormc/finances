import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter, IBM_Plex_Mono } from "next/font/google";
import { ThemeProvider } from "./providers/theme-provider";
import "./globals.css";

// Trio tipográfico da direção "Fechamento de Caixa" (ver DESIGN.md):
// display para títulos, body para texto de interface, mono para todo
// número financeiro (tabular-nums, alinhado como planilha).
const displayFont = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-display" });
const bodyFont = Inter({ subsets: ["latin"], variable: "--font-body" });
const ledgerMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "ControlAI", template: "%s | ControlAI" },
  description: "Controle financeiro inteligente com IA, Open Finance e integração com WhatsApp",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ControlAI",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport = {
  // Grafite quase-preto da direção "Fechamento de Caixa" (ver DESIGN.md) —
  // substitui o indigo #6366f1 da identidade anterior.
  themeColor: "#1C1C1E",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${displayFont.variable} ${bodyFont.variable} ${ledgerMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}})();if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js')})}`,
          }}
        />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
