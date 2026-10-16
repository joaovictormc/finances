"use client";

import { useId } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FieldSpec } from "./block-fields";

type Data = Record<string, unknown>;
/** Erros por caminho do campo, como a validação devolve: "rows.2.amount". */
export type FieldErrors = Record<string, string>;

const inputClass =
  "w-full rounded-md border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary";
const singleLine = "h-10";

function FieldShell({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function ScalarField({
  spec,
  value,
  onChange,
  error,
}: {
  spec: Exclude<FieldSpec, { kind: "list" }>;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
}) {
  const id = useId();
  const border = error ? "border-destructive" : "border-border";

  if (spec.kind === "boolean") {
    return (
      <label htmlFor={id} className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 accent-[var(--color-primary)]"
        />
        {spec.label}
      </label>
    );
  }

  return (
    <FieldShell id={id} label={spec.label} hint={spec.hint} error={error}>
      {spec.kind === "textarea" ? (
        <textarea
          id={id}
          rows={spec.rows ?? 3}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={cn(inputClass, border, "resize-y py-2 leading-relaxed")}
        />
      ) : spec.kind === "select" ? (
        <select id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className={cn(inputClass, singleLine, border)}>
          {spec.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type="text"
          value={String(value ?? "")}
          placeholder={spec.kind === "text" ? spec.placeholder : "signup"}
          onChange={(e) => onChange(e.target.value)}
          className={cn(inputClass, singleLine, border, spec.kind === "href" && "font-mono")}
        />
      )}
    </FieldShell>
  );
}

function ListField({
  spec,
  value,
  onChange,
  errors,
  path,
}: {
  spec: Extract<FieldSpec, { kind: "list" }>;
  value: unknown;
  onChange: (v: unknown) => void;
  errors: FieldErrors;
  path: string;
}) {
  const items = Array.isArray(value) ? (value as Data[]) : [];
  const listError = errors[path];

  const update = (index: number, next: Data) => onChange(items.map((it, i) => (i === index ? next : it)));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-medium text-foreground">{spec.label}</legend>
      {spec.hint && <p className="-mt-1 text-xs text-muted-foreground">{spec.hint}</p>}
      {listError && <p className="text-xs text-destructive">{listError}</p>}

      {items.map((item, index) => (
        <div key={index} className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {spec.itemLabel} {index + 1}
            </span>
            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Mover ${spec.itemLabel.toLowerCase()} ${index + 1} para cima`}
                className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
                aria-label={`Mover ${spec.itemLabel.toLowerCase()} ${index + 1} para baixo`}
                className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
              >
                <ArrowDown size={14} />
              </button>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
                disabled={items.length <= spec.min}
                aria-label={`Remover ${spec.itemLabel.toLowerCase()} ${index + 1}`}
                className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
              >
                <Trash2 size={14} />
              </button>
            </span>
          </div>
          <FieldsEditor
            fields={spec.fields}
            value={item}
            onChange={(next) => update(index, next)}
            errors={errors}
            path={`${path}.${index}`}
            compact
          />
        </div>
      ))}

      {items.length < spec.max && (
        <button
          type="button"
          onClick={() => onChange([...items, structuredClone(spec.newItem)])}
          className="flex w-fit items-center gap-1.5 rounded-md px-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          <Plus size={14} /> Adicionar {spec.itemLabel.toLowerCase()}
        </button>
      )}
    </fieldset>
  );
}

/** Formulário de um objeto a partir da sua lista de campos. */
export function FieldsEditor({
  fields,
  value,
  onChange,
  errors,
  path = "",
  compact = false,
}: {
  fields: FieldSpec[];
  value: Data;
  onChange: (next: Data) => void;
  errors: FieldErrors;
  path?: string;
  compact?: boolean;
}) {
  const at = (key: string) => (path ? `${path}.${key}` : key);
  return (
    <div className={cn("grid gap-x-4 gap-y-5 md:grid-cols-2", compact && "gap-y-4")}>
      {fields.map((spec) => {
        const set = (v: unknown) => onChange({ ...value, [spec.key]: v });
        // Textos longos e listas ocupam a linha inteira; o resto fica em duas colunas.
        const wide = spec.kind === "list" || spec.kind === "textarea";
        return (
          <div key={spec.key} className={cn(wide && "md:col-span-2")}>
            {spec.kind === "list" ? (
              <ListField spec={spec} value={value[spec.key]} onChange={set} errors={errors} path={at(spec.key)} />
            ) : (
              <ScalarField spec={spec} value={value[spec.key]} onChange={set} error={errors[at(spec.key)]} />
            )}
          </div>
        );
      })}
    </div>
  );
}
