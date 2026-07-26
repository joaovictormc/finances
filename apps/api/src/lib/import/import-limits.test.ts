import { describe, expect, it } from "vitest";
import { validateImportFileBatch } from "./import-limits";

const file = (name: string, size: number) => ({ name, size });

describe("validateImportFileBatch", () => {
  it("accepts up to 20 supported statement files within the total limit", () => {
    expect(
      validateImportFileBatch([file("janeiro.csv", 1_000), file("fevereiro.ofx", 2_000)])
    ).toEqual({ totalBytes: 3_000 });
  });

  it("rejects unsupported extensions and oversized files", () => {
    expect(() => validateImportFileBatch([file("extrato.pdf", 1_000)])).toThrow(
      "Formato não suportado"
    );
    expect(() => validateImportFileBatch([file("extrato.csv", 10 * 1024 * 1024 + 1)])).toThrow(
      "excede 10 MB"
    );
  });

  it("rejects more than 20 files or more than 50 MB in total", () => {
    expect(() =>
      validateImportFileBatch(Array.from({ length: 21 }, (_, index) => file(`${index}.csv`, 1)))
    ).toThrow("no máximo 20 arquivos");
    expect(() =>
      validateImportFileBatch(Array.from({ length: 6 }, (_, index) => file(`${index}.csv`, 9 * 1024 * 1024)))
    ).toThrow("excede 50 MB");
  });
});
