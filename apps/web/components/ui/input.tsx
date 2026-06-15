import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          "rounded-md border bg-card px-3 py-2 text-sm text-foreground",
          "placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-2 focus:ring-primary",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          error ? "border-destructive" : "border-border",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
