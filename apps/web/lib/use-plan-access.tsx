"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api-client";

type Subscription = {
  plan: "free" | "pro" | "familia";
  hasIntegrationsModule: boolean;
  hasFamilyModule: boolean;
};

type PlanAccess = {
  plan: "free" | "pro" | "familia";
  loading: boolean;
  /** Pode usar bot/integrações com banco. */
  hasIntegrations: boolean;
  /** Pode CRIAR um grupo novo (precisa do plano Família). */
  canCreateGroup: boolean;
  /** Já tem algum grupo (próprio ou de convite) — mantém acesso à navegação "Família". */
  hasGroupAccess: boolean;
};

const initial: PlanAccess = {
  plan: "free",
  loading: true,
  hasIntegrations: false,
  canCreateGroup: false,
  hasGroupAccess: false,
};

const PlanAccessContext = createContext<PlanAccess>(initial);

/**
 * Busca plano e grupos uma vez por sessão do dashboard. Antes cada chamada de
 * usePlanAccess buscava sozinha — sidebar desktop, sidebar mobile (as duas
 * ficam montadas, só uma aparece) e NavLinks davam 6 requisições por carga.
 */
export function PlanAccessProvider({ children }: { children: React.ReactNode }) {
  const [access, setAccess] = useState<PlanAccess>(initial);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<Subscription>("/api/billing/subscription"),
      api.get<unknown[]>("/api/groups").catch(() => []),
    ])
      .then(([sub, groups]) => {
        if (!active) return;
        setAccess({
          plan: sub.plan,
          loading: false,
          hasIntegrations: sub.hasIntegrationsModule,
          canCreateGroup: sub.hasFamilyModule,
          hasGroupAccess: sub.hasFamilyModule || groups.length > 0,
        });
      })
      .catch(() => {
        if (active) setAccess((prev) => ({ ...prev, loading: false }));
      });
    return () => {
      active = false;
    };
  }, []);

  return <PlanAccessContext.Provider value={access}>{children}</PlanAccessContext.Provider>;
}

export const usePlanAccess = () => useContext(PlanAccessContext);
