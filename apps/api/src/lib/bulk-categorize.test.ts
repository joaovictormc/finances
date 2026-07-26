import { describe, expect, it } from "vitest";
import { BulkCategorizeTransactionsSchema } from "@finances/validations";

describe("BulkCategorizeTransactionsSchema", () => {
  it("accepts a bounded list of unique transaction ids", () => {
    const result = BulkCategorizeTransactionsSchema.parse({
      transactionIds: ["transaction-1", "transaction-2"],
      categoryId: "category-1",
    });

    expect(result.transactionIds).toEqual(["transaction-1", "transaction-2"]);
  });

  it("rejects empty and duplicate selections", () => {
    expect(() =>
      BulkCategorizeTransactionsSchema.parse({ transactionIds: [], categoryId: "category-1" })
    ).toThrow();
    expect(() =>
      BulkCategorizeTransactionsSchema.parse({
        transactionIds: ["transaction-1", "transaction-1"],
        categoryId: "category-1",
      })
    ).toThrow("IDs de transações duplicados");
  });

  it("limits one operation to 100 transactions", () => {
    expect(() =>
      BulkCategorizeTransactionsSchema.parse({
        transactionIds: Array.from({ length: 101 }, (_, index) => `transaction-${index}`),
        categoryId: "category-1",
      })
    ).toThrow();
  });
});
