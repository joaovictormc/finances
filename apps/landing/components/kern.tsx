// Ponto e vírgula da Plus Jakarta 800 têm respiro lateral largo: com o
// tracking negativo dos títulos eles descolam da palavra ("dinheiro .",
// "digitação ,"). Puxar 0.06em de volta faz cada frase ler como uma só.
export function kern(text: string) {
  return text.split(/([.,])/).map((part, i) =>
    part === "." || part === "," ? (
      <span key={i} className="-ml-[0.06em]">
        {part}
      </span>
    ) : (
      part
    )
  );
}
