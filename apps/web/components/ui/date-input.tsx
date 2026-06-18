"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface DateInputProps {
  label?: string;
  error?: string;
  value: string;
  onChange: (isoValue: string) => void;
  className?: string;
  id?: string;
  placeholder?: string;
}

function isoToDigits(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return "";
  return `${m[3]}${m[2]}${m[1]}`;
}

function digitsToDisplay(digits: string): string {
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join("/");
}

function digitsToIso(digits: string): string {
  if (digits.length !== 8) return "";
  return `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
}

export function DateInput({ label, error, value, onChange, className, id, placeholder = "DD/MM/AAAA" }: DateInputProps) {
  const [digits, setDigits] = useState(() => isoToDigits(value));
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      const next = digits.slice(0, -1);
      setDigits(next);
      onChange(digitsToIso(next));
      e.preventDefault();
      return;
    }
    if (!/^\d$/.test(e.key)) return;
    // Campo já completo: começa um novo valor em vez de travar a digitação.
    const base = digits.length >= 8 ? "" : digits;
    const next = base + e.key;
    setDigits(next);
    onChange(digitsToIso(next));
    e.preventDefault();
  };

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <input
        id={inputId}
        type="text"
        inputMode="numeric"
        value={digitsToDisplay(digits)}
        onKeyDown={handleKeyDown}
        onChange={() => {}}
        placeholder={placeholder}
        className={cn(
          "rounded-md border bg-card px-3 py-2 text-sm text-foreground",
          "placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-2 focus:ring-primary",
          error ? "border-destructive" : "border-border",
          className
        )}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
