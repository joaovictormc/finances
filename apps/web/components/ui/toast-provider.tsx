"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Toast, type ToastItem, type ToastVariant } from "./toast";

interface ToastContextValue {
  toast: (opts: { title: string; description?: string; variant?: ToastVariant }) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, variant = "success" }: { title: string; description?: string; variant?: ToastVariant }) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, title, description, variant }]);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end">
        {toasts.map((item) => (
          <Toast key={item.id} item={item} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
