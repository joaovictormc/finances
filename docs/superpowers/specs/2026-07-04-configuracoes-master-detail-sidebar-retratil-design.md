# Design: Configurações em master-detail + menu lateral retrátil

## Contexto

A tela de Configurações do web (`apps/web/app/(dashboard)/settings/page.tsx`)
hoje é uma pilha vertical de ~9 cards (Perfil, Segurança, Tema, Relatório
anual, Indicações, Telegram, Notificações, Meus dados), todos renderizados
de uma vez, com a página crescendo a cada nova seção adicionada nas fases
anteriores do roadmap. Outras aplicações usam um padrão diferente: uma
lista de seções na área esquerda e só o conteúdo da seção ativa à direita
(Stripe, GitHub, Linear). O usuário pediu pra adotar esse padrão aqui.

Ao mesmo tempo, o menu lateral principal do dashboard
(`apps/web/app/(dashboard)/layout.tsx` + `NavLinks`) não tem opção de
retrair — fica sempre no tamanho cheio (`w-60`), mesmo pra quem prefere
mais espaço de tela pro conteúdo.

## Decisões já validadas (brainstorming com companion visual)

- **Configurações**: layout master-detail — lista de seções à esquerda,
  só a seção ativa renderiza à direita (não é um índice com scroll-spy).
- A aba ativa fica **na URL** (`/settings?tab=X`), sobrevive a F5 e pode
  ser compartilhada/favoritada.
- **"Planos e Assinatura"** entra como mais um item da lista lateral, mas
  continua navegando pra `/settings/billing` normalmente (não faz parte do
  master-detail — é um link de saída, não uma seção com painel).
- **Menu lateral**: retrai pra um rail de ícones (não esconde totalmente).
- Botão de retrair/expandir fica **no topo do menu, ao lado do logo**.
- O estado retraído/expandido **persiste** entre sessões (localStorage,
  mesmo padrão do tema).
- Fora de escopo: `MobileSidebar`/`MobileBottomNav` (menu mobile do site
  web) não mudam — a retração só existe no menu desktop (`hidden lg:flex`).

## Parte 1 — Configurações em master-detail

### Componentes

**`apps/web/components/settings/settings-nav.tsx`** (novo)

Lista de itens de navegação da tela de Configurações, mesmo estilo visual
do `NavLinks` do menu principal (ícone + label, estado ativo destacado).

```ts
type SettingsSection = "perfil" | "seguranca" | "tema" | "notificacoes" | "relatorio" | "indicacoes" | "telegram" | "dados";

const SETTINGS_SECTIONS: { id: SettingsSection; label: string; icon: LucideIcon }[] = [
  { id: "perfil", label: "Perfil", icon: User },
  { id: "seguranca", label: "Segurança", icon: ShieldCheck },
  { id: "tema", label: "Tema", icon: SunMoon },
  { id: "notificacoes", label: "Notificações", icon: Bell },
  { id: "relatorio", label: "Relatório anual", icon: FileDown },
  { id: "indicacoes", label: "Indique e ganhe", icon: Gift },
  { id: "telegram", label: "Telegram", icon: Bot },
  { id: "dados", label: "Meus dados", icon: Database },
];
```

Recebe `activeSection: SettingsSection` via prop (lida da URL pelo pai) e
renderiza cada item como `<Link href={`/settings?tab=${id}`}>`. O item
"Planos e Assinatura" é renderizado separadamente dentro do mesmo `<nav>`
(mesmo estilo visual, mas `href="/settings/billing"` direto — sem lógica de
seção ativa, é navegação normal pra outra rota).

### Extração das seções inline

Hoje `page.tsx` tem ~260 linhas com Perfil, Tema, Relatório anual e
Notificações inline (o resto — Segurança, Trocar senha, Excluir conta,
Indicações — já são componentes próprios desde fases anteriores). Pra
manter a mesma granularidade, extrair:

- `apps/web/components/settings/profile-section.tsx` — formulário de nome
  + email (hoje linhas ~118-136 de `page.tsx`).
- `apps/web/components/settings/theme-section.tsx` — os 3 botões de tema
  (Claro/Escuro/Sistema), usando `useTheme()` direto (não precisa receber
  nada via prop).
- `apps/web/components/settings/annual-report-section.tsx` — seletor de
  ano + botão de baixar PDF.
- `apps/web/components/settings/notifications-section.tsx` — os 3 toggles
  (email/Telegram/preditivo), com fetch/patch de
  `/api/settings/notifications` movido pra dentro do componente (hoje esse
  estado vive em `page.tsx` e é passado via props pros `ToggleRow`).

Cada seção existente (`TwoFactorSection`, `ChangePasswordSection`,
`DeleteAccountSection`, `ReferralSection`, `TelegramLink`,
export/download de dados) continua exatamente como está — só muda *onde*
são renderizadas.

### `page.tsx` (reescrito)

```tsx
"use client";
import { Suspense } from "react";
// ...

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeSection = (searchParams.get("tab") as SettingsSection) || "perfil";

  return (
    <div>
      <h1>Configurações</h1>
      <div className="flex gap-6">
        <SettingsNav activeSection={activeSection} />
        <div className="flex-1">
          {activeSection === "perfil" && <ProfileSection />}
          {activeSection === "seguranca" && (
            <>
              <ChangePasswordSection />
              <TwoFactorSection />
            </>
          )}
          {activeSection === "tema" && <ThemeSection />}
          {activeSection === "notificacoes" && <NotificationsSection />}
          {activeSection === "relatorio" && <AnnualReportSection />}
          {activeSection === "indicacoes" && <ReferralSection />}
          {activeSection === "telegram" && <TelegramLink />}
          {activeSection === "dados" && (
            <>
              {/* botão de exportar dados */}
              <DeleteAccountSection />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsContent />
    </Suspense>
  );
}
```

(`Suspense` é necessário porque `useSearchParams` exige isso no App Router
— mesmo padrão já usado em `login/page.tsx` e `verify-email/page.tsx`.)

Um valor de `tab` desconhecido/ausente cai no default `"perfil"` — não há
tela de erro pra uma seção inválida, só o fallback silencioso.

### Responsividade

Em telas pequenas (mobile web), o layout de duas colunas
(`SettingsNav` + painel) precisa colapsar pra uma coluna — a lista de
seções fica em cima (scroll horizontal ou lista vertical compacta) e o
painel da seção ativa abaixo. Isso é ajuste de CSS (`flex-col md:flex-row`
ou similar), sem mudança de lógica.

## Parte 2 — Menu lateral retrátil

### `apps/web/app/providers/sidebar-provider.tsx` (novo)

Mesmo formato do `ThemeProvider`: Context + `localStorage`, sem
dependência de servidor.

```tsx
"use client";
const SidebarContext = createContext<{ collapsed: boolean; toggleCollapsed: () => void }>(...);

export function SidebarProvider({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      localStorage.setItem("sidebar-collapsed", String(!prev));
      return !prev;
    });
  };

  return <SidebarContext.Provider value={{ collapsed, toggleCollapsed }}>{children}</SidebarContext.Provider>;
}

export const useSidebar = () => useContext(SidebarContext);
```

### `apps/web/app/(dashboard)/layout.tsx`

Envolve todo o conteúdo com `<SidebarProvider>`. O `<aside>` passa a usar
`useSidebar()` pra decidir a largura (`w-16` colapsado / `w-60` expandido,
com `transition-all` pra animar a troca). O cabeçalho do menu (logo +
`ThemeToggle`) ganha o novo botão de retrair/expandir ao lado do logo —
quando colapsado, o logo encolhe pra só o ícone/monograma (checar se
`Logo` já suporta isso via a prop `size`) e o `ThemeToggle` pode ficar
escondido nesse estado (não é essencial ver o toggle de tema com o menu
fechado) ou mover pra dentro do rail — a decidir na implementação, sem
impacto de arquitetura.

### `NavLinks`

Ganha uma prop `collapsed: boolean`. Quando `true`:
- Cada item vira só o ícone, centralizado, com `title={item.label}` pro
  tooltip nativo do navegador (sem precisar de um componente de tooltip
  próprio — suficiente pro caso de uso).
- O `<span className="flex-1">{item.label}</span>` não renderiza.
- O ícone de cadeado (`Lock`, pra itens bloqueados por plano) continua
  aparecendo, sobreposto/pequeno, já que também é informação compacta.

### Rodapé do menu (plano gratuito + `UserMenu`)

Também precisa de uma variante colapsada: o aviso de "Plano Gratuito" +
link de upgrade (texto) fica oculto quando colapsado, sobrando só o avatar
do `UserMenu` (que já é só um círculo com inicial — o nome/email ao lado
que precisa esconder). `UserMenu` ganha a mesma prop `collapsed` que
`NavLinks`.

### Fora de escopo

- `MobileSidebar` (drawer que abre em telas `lg:hidden`) e
  `MobileBottomNav` não mudam — a lógica de retração só existe no `<aside>`
  fixo de telas grandes.
- Não cria uma versão "auto-colapsa em tela média" — é manual, controlado
  só pelo botão.

## Testes / verificação manual

- Configurações: navegar entre todas as 8 seções + o link de billing,
  confirmar que a URL muda (`?tab=...`), que F5 mantém a seção ativa, e
  que um `?tab=inexistente` cai no Perfil sem quebrar.
- Menu lateral: retrair, recarregar a página, confirmar que continua
  retraído; expandir, verificar que os labels voltam; testar em cada
  página do dashboard que o menu retraído ainda permite navegar (tooltip
  aparece, clique funciona).
- `pnpm --filter @finances/web typecheck` sem erros.
