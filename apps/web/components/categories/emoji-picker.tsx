"use client";

import { SmilePlus } from "lucide-react";
import { cn } from "@/lib/utils";

// Lista curta e escolhida a dedo pra categorias de finanças: uma biblioteca de
// emojis completa pesaria centenas de KB no bundle por um campo opcional.
const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: "Casa", emojis: ["🏠", "🛋️", "💡", "🚿", "🧹", "🔧", "🪴", "📦"] },
  { label: "Comida", emojis: ["🛒", "🍽️", "🍔", "🍕", "☕", "🍺", "🥦", "🍰"] },
  { label: "Transporte", emojis: ["🚗", "⛽", "🚌", "🚕", "🚲", "✈️", "🅿️", "🛵"] },
  { label: "Saúde", emojis: ["💊", "🏥", "🦷", "🏋️", "🧘", "👓", "🩺", "💆"] },
  { label: "Lazer", emojis: ["🎬", "🎮", "🎵", "📚", "⚽", "🎉", "🏖️", "🎨"] },
  { label: "Pessoas", emojis: ["👶", "🧒", "👨‍👩‍👧", "🐶", "🐱", "🎁", "💍", "👕"] },
  { label: "Dinheiro", emojis: ["💰", "💵", "💳", "🏦", "📈", "🧾", "💼", "🪙"] },
  { label: "Outros", emojis: ["📱", "💻", "🎓", "✂️", "⛪", "🤝", "⭐", "🏷️"] },
];

/** Botão quadrado que mostra o emoji escolhido (ou um marcador) e abre/fecha a grade. */
export function EmojiButton({
  value,
  open,
  onToggle,
}: {
  value: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={value ? `Ícone: ${value}. Trocar ícone` : "Escolher ícone"}
      aria-expanded={open}
      className={cn(
        "flex h-9 w-11 shrink-0 items-center justify-center rounded-md border bg-card text-lg transition-colors",
        open ? "border-primary ring-2 ring-primary" : "border-border hover:bg-accent"
      )}
    >
      {value || <SmilePlus size={16} className="text-muted-foreground" />}
    </button>
  );
}

/** Grade de emojis agrupados. Fica no fluxo da página (não é popup) pra não ser cortada pela rolagem de um modal. */
export function EmojiGrid({ value, onSelect }: { value: string; onSelect: (emoji: string) => void }) {
  return (
    <div className="rounded-md border border-border bg-card p-2">
      <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
        {EMOJI_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {group.label}
            </p>
            <div className="grid grid-cols-8 gap-1">
              {group.emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onSelect(emoji)}
                  aria-label={`Usar ${emoji}`}
                  aria-pressed={value === emoji}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded text-lg hover:bg-accent",
                    value === emoji && "bg-primary/20 ring-1 ring-primary"
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {value && (
        <button
          type="button"
          onClick={() => onSelect("")}
          className="mt-2 w-full rounded py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          Sem ícone
        </button>
      )}
    </div>
  );
}
