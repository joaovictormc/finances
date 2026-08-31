"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast-provider";
import type { NotificationPreferences } from "@/lib/types";

export function NotificationsSection() {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);

  useEffect(() => {
    api
      .get<NotificationPreferences>("/api/settings/notifications")
      .then(setPrefs)
      .catch(() => {});
  }, []);

  async function updatePref(key: keyof NotificationPreferences, value: boolean) {
    const previous = prefs;
    setPrefs((prev) => (prev ? { ...prev, [key]: value } : prev));
    try {
      await api.patch<NotificationPreferences>("/api/settings/notifications", { [key]: value });
    } catch {
      setPrefs(previous);
      toast({ title: "Erro ao salvar preferência", variant: "error" });
    }
  }

  return (
    <div className="space-y-3">
      <ToggleRow
        label="Alertas por email"
        description="Receba avisos de orçamento e vencimentos por email"
        enabled={prefs?.notifyEmail ?? true}
        onToggle={(v) => updatePref("notifyEmail", v)}
      />
      <ToggleRow
        label="Alertas preditivos"
        description="Avisos quando você estiver no caminho de ultrapassar um orçamento"
        enabled={prefs?.aiInsightsEnabled ?? true}
        onToggle={(v) => updatePref("aiInsightsEnabled", v)}
      />
    </div>
  );
}

function ToggleRow({
  label,
  description,
  enabled,
  onToggle,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-border last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onToggle(!enabled)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          enabled ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
