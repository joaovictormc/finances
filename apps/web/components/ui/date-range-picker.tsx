"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";
import "react-day-picker/style.css";
import { formatShortDate } from "@/lib/utils";

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (range: { startDate: string; endDate: string }) => void;
  className?: string;
}

function isoToLocalDate(iso: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function localDateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shortcuts(): { label: string; range: DateRange }[] {
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);
  const thisMonthStart = startOfMonth(today);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  return [
    { label: "Hoje", range: { from: today, to: today } },
    { label: "Últimos 7 dias", range: { from: sevenDaysAgo, to: today } },
    { label: "Este mês", range: { from: thisMonthStart, to: today } },
    { label: "Mês passado", range: { from: lastMonthStart, to: lastMonthEnd } },
  ];
}

export function DateRangePicker({ startDate, endDate, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const committedRange: DateRange | undefined = {
    from: isoToLocalDate(startDate),
    to: isoToLocalDate(endDate),
  };
  // seleção em andamento no calendário — só vira filtro quando tiver início E fim
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    setPendingRange(committedRange.from || committedRange.to ? committedRange : undefined);
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const applyRange = (r: DateRange | undefined) => {
    onChange({
      startDate: r?.from ? localDateToIso(r.from) : "",
      endDate: r?.to ? localDateToIso(r.to) : "",
    });
  };

  const label =
    committedRange.from && committedRange.to
      ? `${formatShortDate(committedRange.from)} — ${formatShortDate(committedRange.to)}`
      : "Período";

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary whitespace-nowrap"
      >
        📅 {label}
      </button>

      {open && (
        <div className="absolute z-50 mt-2 flex gap-3 rounded-lg border border-border bg-card p-3 shadow-lg">
          <div className="flex flex-col gap-1 pr-3 border-r border-border min-w-[140px]">
            {shortcuts().map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => {
                  applyRange(s.range);
                  setOpen(false);
                }}
                className="text-left text-sm px-2 py-1.5 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                {s.label}
              </button>
            ))}
          </div>
          <DayPicker
            mode="range"
            min={1}
            selected={pendingRange}
            onSelect={(r) => {
              setPendingRange(r);
              if (r?.from && r?.to) {
                applyRange(r);
                setOpen(false);
              }
            }}
            locale={ptBR}
            style={
              {
                color: "var(--color-foreground)",
                "--rdp-accent-color": "var(--color-primary)",
                "--rdp-accent-background-color": "var(--color-muted)",
                "--rdp-today-color": "var(--color-primary)",
              } as React.CSSProperties
            }
          />
        </div>
      )}
    </div>
  );
}
