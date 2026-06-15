"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

interface CurrencyInputProps {
  label?: string;
  error?: string;
  value: number;
  onChange: (cents: number) => void;
  className?: string;
  id?: string;
}

export function parseBRL(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  return parseInt(digits || "0", 10);
}

export function formatCents(cents: number): string {
  if (cents === 0) return "";
  const value = cents / 100;
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function CurrencyInput({ label, error, value, onChange, className, id }: CurrencyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      onChange(Math.floor(value / 10));
      e.preventDefault();
      return;
    }
    if (!/^\d$/.test(e.key)) return;
    const newCents = value * 10 + parseInt(e.key, 10);
    if (newCents > 9_999_999_99) return;
    onChange(newCents);
    e.preventDefault();
  };

  const displayValue = formatCents(value);

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">
          R$
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="numeric"
          value={displayValue}
          onKeyDown={handleKeyDown}
          onChange={() => {}}
          placeholder="0,00"
          className={cn(
            "w-full rounded-md border bg-card pl-10 pr-3 py-2 text-sm text-foreground text-right",
            "placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-primary",
            error ? "border-destructive" : "border-border",
            className
          )}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
