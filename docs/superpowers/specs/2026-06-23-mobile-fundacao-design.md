# App mobile — Fundação (autenticação, navegação, cliente de API)

## Contexto

`apps/mobile` (Expo SDK 54 + Expo Router v4) hoje é só o scaffold inicial (`(tabs)/index.tsx`, `_layout.tsx`), sem nenhuma tela real, listado como pendência em `docs/next-version.md`. O projeto é grande o suficiente pra precisar de decomposição em sub-projetos: **Fundação** (este) → MVP de telas essenciais (Visão Geral/Transações/Contas) → paridade ampliada (Orçamentos/Metas/Bills/Grupos) → recursos avançados (push, biometria, offline). Esta spec cobre só a Fundação — tudo que os próximos sub-projetos vão precisar pra existir: autenticação, navegação e cliente de API.

O web usa Better Auth com sessão via cookie (`credentials: "include"`). Mobile não tem cookie jar confiável entre o app e a API, então precisa de um mecanismo de sessão diferente.

## Mudanças

### 1. Autenticação por Bearer token
- **`apps/api/src/lib/auth.ts`**: adicionar o plugin `bearer` (`better-auth/plugins/bearer`, já disponível na versão instalada do `better-auth`) à configuração do `betterAuth({...})`. Isso faz o Better Auth aceitar `Authorization: Bearer <token>` como alternativa ao cookie — o fluxo do web (cookie) continua funcionando sem nenhuma mudança.
- **`apps/mobile`**: adicionar `@better-auth/expo` (cliente oficial do Better Auth pra Expo) e `expo-secure-store`. O cliente Expo já integra com `expo-secure-store` pra guardar o token de forma criptografada no device e injetar automaticamente o header `Authorization` nas requisições.
- Novo `apps/mobile/lib/auth-client.ts`: instância do cliente Better Auth configurada com a URL da API (`EXPO_PUBLIC_API_URL`) e o plugin Expo.

### 2. Telas de autenticação
- `apps/mobile/app/(auth)/login.tsx` — email + senha, usando `authClient.signIn.email`.
- `apps/mobile/app/(auth)/register.tsx` — nome + email + senha, usando `authClient.signUp.email`.
- Validação client-side reaproveitando os schemas já existentes em `packages/validations` (mesmo padrão de validação usado no web).
- Sem Google OAuth nesta fase (fica pra uma fase futura — exige configuração nativa extra de deep link/client ID por plataforma).

### 3. Cliente de API
- Novo `apps/mobile/lib/api-client.ts`, mesmo formato do `apps/web/lib/api-client.ts` (`api.get/post/patch/delete`), mas:
  - Base URL via `EXPO_PUBLIC_API_URL` (env do Expo, equivalente ao `NEXT_PUBLIC_API_URL` do web).
  - Em vez de `credentials: "include"`, usa o token de `expo-secure-store` (via helper do `@better-auth/expo`) no header `Authorization`.

### 4. Estilização — NativeWind
- Instalar e configurar NativeWind (`tailwind.config.js` em `apps/mobile`, `babel.config.js` ajustado conforme docs do NativeWind pra Expo Router).
- Tokens de cor do tema (hoje em OKLCH em `apps/web/app/globals.css`) convertidos pra valores hex/RGB equivalentes no `tailwind.config.js` do mobile — NativeWind não lê variáveis CSS OKLCH diretamente. Mesma paleta indigo, claro e escuro.

### 5. Navegação e guarda de rota
- `apps/mobile/app/(tabs)/_layout.tsx`: 4 abas placeholder — Visão Geral, Transações, Contas, Mais (cada tela só com texto "Em breve" — conteúdo real entra no próximo sub-projeto).
- `apps/mobile/app/_layout.tsx`: lógica de guarda — se não houver sessão válida (`authClient.useSession()`), redireciona pra `(auth)/login`; mesmo padrão de proteção de rota já usado no web (`proxy.ts`).

## Fora de escopo
Google OAuth no mobile; qualquer tela de dados reais (Transações, Contas, Orçamentos etc. — próximo sub-projeto); push notifications; modo offline; biometria.

## Verificação
- `pnpm --filter @finances/mobile typecheck` sem erros.
- Abrir o app no Expo Go (ou simulador) → tela de login aparece se não houver sessão.
- Criar conta nova pelo mobile → login automático → vê as 4 abas placeholder.
- Fechar e reabrir o app → sessão persiste (token recuperado do `expo-secure-store`), sem precisar logar de novo.
- Logar com uma conta já existente (criada pelo web) → funciona igual, confirmando que o plugin `bearer` não quebrou o login por cookie do web (`pnpm --filter @finances/web dev` continua autenticando normalmente).
