"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { authClient, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/use-hydrated";

export function UserMenu({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const hydrated = useHydrated();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  // Durante a hidratação, o mesmo esqueleto do servidor (que não tem a sessão).
  if (!hydrated || isPending) {
    return <div className="h-9 animate-pulse rounded-md bg-muted" />;
  }

  const user = session?.user;
  if (!user) return null;

  const initial = (user.name || user.email || "?").charAt(0).toUpperCase();

  return (
    <div className={cn("flex items-center gap-2", collapsed && "flex-col")}>
      <div
        title={collapsed ? user.name || user.email : undefined}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
      >
        {initial}
      </div>
      {!collapsed && (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{user.name || "Usuário"}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      )}
      <button
        type="button"
        onClick={handleSignOut}
        disabled={loading}
        title="Sair"
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
