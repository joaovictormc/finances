"use client";

import { useEffect, useState } from "react";
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

export function usePlanAccess(): PlanAccess {
  const [plan, setPlan] = useState<Subscription["plan"]>("free");
  const [hasIntegrations, setHasIntegrations] = useState(false);
  const [canCreateGroup, setCanCreateGroup] = useState(false);
  const [hasGroupAccess, setHasGroupAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<Subscription>("/api/billing/subscription"),
      api.get<unknown[]>("/api/groups").catch(() => []),
    ])
      .then(([sub, groups]) => {
        if (!active) return;
        setPlan(sub.plan);
        setHasIntegrations(sub.hasIntegrationsModule);
        setCanCreateGroup(sub.hasFamilyModule);
        setHasGroupAccess(sub.hasFamilyModule || groups.length > 0);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { plan, loading, hasIntegrations, canCreateGroup, hasGroupAccess };
}
