import { scorePassword, type PasswordStrength } from "@finances/validations";

const LABEL: Record<PasswordStrength, string> = {
  "muito-fraca": "Muito fraca",
  fraca: "Fraca",
  media: "Média",
  forte: "Forte",
};

const COLOR: Record<PasswordStrength, string> = {
  "muito-fraca": "bg-destructive",
  fraca: "bg-warning",
  media: "bg-warning",
  forte: "bg-success",
};

export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;

  const { score, strength } = scorePassword(password);
  const bars = 4;

  return (
    <div className="mt-1.5 flex items-center gap-2">
      <div className="flex flex-1 gap-1">
        {Array.from({ length: bars }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${i < score ? COLOR[strength] : "bg-muted"}`}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">{LABEL[strength]}</span>
    </div>
  );
}
