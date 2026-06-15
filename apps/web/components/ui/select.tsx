import { cn } from "@/lib/utils";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  label?: string;
  error?: string;
  placeholder?: string;
}

export function Select({ options, label, error, placeholder, className, id, ...props }: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          "rounded-md border bg-card px-3 py-2 text-sm text-foreground",
          "focus:outline-none focus:ring-2 focus:ring-primary",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          error ? "border-destructive" : "border-border",
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
