import { useEffect, useState } from "react";
import { Text, TextInput } from "react-native";
import { useTheme } from "@/lib/theme";

/** "2026-08-29" -> "29/08/2026". Valor vazio ou fora do padrão vira "". */
function isoToBr(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return "";
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/** "29/08/2026" -> "2026-08-29". Devolve "" enquanto a data está incompleta. */
function brToIso(br: string): string {
  const digits = br.replace(/\D/g, "");
  if (digits.length !== 8) return "";
  return `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
}

/** Insere as barras conforme digita, sem travar o apagar (opera só nos dígitos). */
function maskBr(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Campo de data no formato brasileiro. O app inteiro guarda data como
 * `YYYY-MM-DD` (é o que a API espera), mas mostrar isso pro usuário é ruim —
 * e ainda esconde erro de leitura do cupom, difícil de notar em ISO.
 * Aqui a conversão fica num lugar só: o pai continua recebendo `YYYY-MM-DD`.
 */
export function DateField({
  label,
  value,
  onChange,
  className = "mb-4",
}: {
  label: string;
  /** Data em `YYYY-MM-DD`, ou "" quando vazia. */
  value: string;
  /** Recebe `YYYY-MM-DD`, ou "" enquanto a data estiver incompleta. */
  onChange: (iso: string) => void;
  /** Margem do input, que varia entre as telas. */
  className?: string;
}) {
  const { colors } = useTheme();
  const [text, setText] = useState(() => isoToBr(value));

  // Ressincroniza quando o valor muda por fora — é o caso da leitura de cupom,
  // que preenche a data sem o usuário digitar nada.
  useEffect(() => {
    if (brToIso(text) !== value) setText(isoToBr(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleChange(input: string) {
    const masked = maskBr(input);
    setText(masked);
    // Propaga "" enquanto incompleta, de propósito: se mantivesse o valor
    // anterior, o usuário salvaria uma data diferente da que está vendo.
    onChange(brToIso(masked));
  }

  return (
    <>
      <Text className="mb-1 text-sm font-medium text-foreground dark:text-foreground-dark">
        {label}
      </Text>
      <TextInput
        className={`${className} rounded-md border border-border bg-card px-3 py-3 text-foreground dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark`}
        placeholder="DD/MM/AAAA"
        placeholderTextColor={colors.mutedForeground}
        keyboardType="number-pad"
        maxLength={10}
        value={text}
        onChangeText={handleChange}
      />
    </>
  );
}
