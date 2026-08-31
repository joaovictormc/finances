import { describe, expect, it } from "vitest";
import { getPaymentMethodDef, maskSecrets, PAYMENT_METHODS } from "./payment-methods";

describe("maskSecrets", () => {
  it("zera os campos secretos e reporta quais estavam preenchidos", () => {
    const { config, secretsSet } = maskSecrets("mercadopago", {
      accessToken: "APP_USR-1234",
      publicKey: "APP_USR-pub",
      webhookSecret: "assinatura",
    });

    expect(config.accessToken).toBe("");
    expect(config.webhookSecret).toBe("");
    expect(config.publicKey).toBe("APP_USR-pub"); // não é secret, volta em texto
    expect(secretsSet.sort()).toEqual(["accessToken", "webhookSecret"]);
  });

  it("não reporta como preenchido o segredo que está vazio", () => {
    const { config, secretsSet } = maskSecrets("mercadopago", {
      accessToken: "",
      publicKey: "APP_USR-pub",
    });

    expect(config.accessToken).toBe("");
    expect(secretsSet).toEqual([]);
  });

  it("devolve o config intacto quando o método não tem campo secreto", () => {
    const { config, secretsSet } = maskSecrets("pix", {
      key: "chave@exemplo.com",
      receiverName: "Fulano",
      receiverCity: "Recife",
    });

    expect(config.key).toBe("chave@exemplo.com");
    expect(secretsSet).toEqual([]);
  });

  it("não devolve nenhum campo marcado como secret em texto puro", () => {
    // Trava genérica: vale para qualquer campo secret adicionado no futuro.
    for (const method of PAYMENT_METHODS) {
      const filled = Object.fromEntries(method.fields.map((field) => [field.key, "valor-real"]));
      const { config } = maskSecrets(method.id, filled);

      for (const field of method.fields) {
        if (field.secret) expect(config[field.key]).toBe("");
      }
    }
  });
});

describe("getPaymentMethodDef", () => {
  it("falha alto para um método desconhecido", () => {
    expect(() => getPaymentMethodDef("paypal" as never)).toThrow();
  });
});
