"use client";

import { useEffect, useState } from "react";
import { X, CheckCircle, AlertCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "warning";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

const icons: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle size={16} className="text-success" />,
  error: <AlertCircle size={16} className="text-destructive" />,
  warning: <AlertTriangle size={16} className="text-warning" />,
};

const borderColors: Record<ToastVariant, string> = {
  success: "border-success/40",
  error: "border-destructive/40",
  warning: "border-warning/40",
};

const barColors: Record<ToastVariant, string> = {
  success: "bg-success",
  error: "bg-destructive",
  warning: "bg-warning",
};

export function Toast({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p <= 0) {
          clearInterval(interval);
          return 0;
        }
        return p - 100 / 40;
      });
    }, 100);
    const timer = setTimeout(() => onRemove(item.id), 4000);
    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [item.id, onRemove]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card shadow-lg min-w-[280px] max-w-sm",
        "transition-all duration-200",
        borderColors[item.variant],
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      )}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="mt-0.5 shrink-0">{icons[item.variant]}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{item.title}</p>
          {item.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
          )}
        </div>
        <button
          onClick={() => onRemove(item.id)}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={14} />
        </button>
      </div>
      <div
        className={cn("absolute bottom-0 left-0 h-[3px] transition-all duration-100", barColors[item.variant])}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
