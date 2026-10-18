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
  description: "Controle financeiro da família, com assistente de IA",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ControlAI",
  },
  // favicon.ico (16/32/48) vem de app/favicon.ico pela convenção do Next; o
  // SVG fica nítido em qualquer densidade nos navegadores que o aceitam.
  icons: {
    icon: [
      { url: "/icons/logo.svg", type: "image/svg+xml" },
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
  // Ocupa a tela inteira do iPhone (atrás do relógio e da linha de gesto) e
  // libera os env(safe-area-inset-*) que o layout usa para não ficar por baixo.
  viewportFit: "cover",
};

const THEME_SCRIPT = `(function(){var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}})();`;

// Service worker só em produção. Ele serve /_next/static/ do cache (cache-first),
// o que é seguro com os nomes com hash do build, mas no `next dev` os arquivos
// não têm hash: o navegador ficava com o JavaScript antigo e o React acusava
// hydration mismatch. Em dev, remove o que tiver sido registrado antes.
const SW_SCRIPT =
  process.env.NODE_ENV === "production"
    ? `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js')})}`
    : `if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){r.unregister()})});if(window.caches){caches.keys().then(function(ks){ks.forEach(function(k){if(k.indexOf('finances-static')===0)caches.delete(k)})})}}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${displayFont.variable} ${bodyFont.variable} ${ledgerMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_SCRIPT + SW_SCRIPT,
          }}
        />
      </head>
      <body className="min-h-full bg-background text-foreground">
        {/* App instalado no iPhone (barra "black-translucent"): relógio e
            bateria são sempre brancos e ficam por cima do app. Esta faixa
            grafite garante o contraste nos dois temas. Fora do app instalado
            a área segura do topo é zero e a faixa some. */}
        <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[env(safe-area-inset-top)] bg-[#1C1C1E]" />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
