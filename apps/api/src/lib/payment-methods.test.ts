import { beforeEach, describe, expect, it, vi } from "vitest";
import { isEncryptedField } from "@finances/db";
import {
  decryptConfig,
  getPaymentMethodDef,
  maskSecrets,
  PAYMENT_METHODS,
  readPaymentMethodConfig,
  updatePaymentMethodConfig,
  type PaymentMethodId,
} from "./payment-methods";

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

// ── Segredos criptografados em repouso ───────────────────────────────────────

// `vi.hoisted` porque o factory do `vi.mock` roda antes das declarações do módulo.
const dbMock = vi.hoisted(() => ({
  paymentMethodConfig: { upsert: vi.fn(), update: vi.fn() },
}));

// Só o `db` é trocado — a criptografia roda de verdade, senão o teste não
// prova que o que iria pro banco deixou de ser o texto puro.
vi.mock("@finances/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@finances/db")>()),
  db: dbMock,
}));

const KEY = "chave-de-teste-payment-methods";

type StoredConfig = Record<string, string>;

/** Faz o upsert devolver a linha como ela estaria gravada no banco. */
function givenStored(id: PaymentMethodId, config: StoredConfig, enabled = false) {
  dbMock.paymentMethodConfig.upsert.mockResolvedValue({ id, enabled, config });
}

/** O config que a última chamada de update mandaria pro banco. */
function lastStored(): StoredConfig {
  const call = dbMock.paymentMethodConfig.update.mock.calls.at(-1);
  if (!call) throw new Error("db.paymentMethodConfig.update não foi chamado");
  return (call[0] as { data: { config: StoredConfig } }).data.config;
}

describe("segredos de pagamento em repouso", () => {
  beforeEach(() => {
    process.env.APP_ENCRYPTION_KEY = KEY;
    dbMock.paymentMethodConfig.upsert.mockReset();
    dbMock.paymentMethodConfig.update.mockReset();
    dbMock.paymentMethodConfig.update.mockImplementation(
      async ({ data }: { data: { enabled: boolean; config: StoredConfig } }) => ({
        id: "mercadopago",
        ...data,
      })
    );
  });

  it("não deixa o segredo chegar ao banco em texto puro", async () => {
    givenStored("mercadopago", {});

    await updatePaymentMethodConfig("mercadopago", {
      enabled: true,
      config: { accessToken: "APP_USR-1234", publicKey: "APP_USR-pub" },
    });

    const stored = lastStored();
    expect(isEncryptedField(stored.accessToken ?? "")).toBe(true);
    expect(JSON.stringify(stored)).not.toContain("APP_USR-1234");
    expect(stored.publicKey).toBe("APP_USR-pub"); // não é secret, fica legível pro admin conferir
  });

  it("devolve o valor original na leitura", async () => {
    givenStored("mercadopago", {});
    await updatePaymentMethodConfig("mercadopago", {
      config: { accessToken: "APP_USR-1234", webhookSecret: "assinatura" },
    });

    givenStored("mercadopago", lastStored(), true);
    const { config } = await readPaymentMethodConfig("mercadopago");

    expect(config.accessToken).toBe("APP_USR-1234");
    expect(config.webhookSecret).toBe("assinatura");
  });

  it("mantém o segredo atual quando o admin salva sem retypá-lo", async () => {
    givenStored("mercadopago", {});
    await updatePaymentMethodConfig("mercadopago", { config: { accessToken: "APP_USR-1234" } });

    // O formulário devolve "" nos campos secretos que não foram tocados.
    givenStored("mercadopago", lastStored(), true);
    await updatePaymentMethodConfig("mercadopago", {
      config: { accessToken: "", publicKey: "APP_USR-pub" },
    });

    const plain = decryptConfig("mercadopago", lastStored());
    expect(plain.accessToken).toBe("APP_USR-1234");
    expect(plain.publicKey).toBe("APP_USR-pub");
  });

  it("converte registro legado em texto puro ao salvar", async () => {
    // Estado anterior à criptografia: valor sem marca de formato no banco.
    givenStored("mercadopago", { accessToken: "APP_USR-legado" });

    await updatePaymentMethodConfig("mercadopago", { enabled: true });

    const stored = lastStored();
    expect(isEncryptedField(stored.accessToken ?? "")).toBe(true);
    expect(decryptConfig("mercadopago", stored).accessToken).toBe("APP_USR-legado");
  });

  it("lê registro legado sem precisar da chave", async () => {
    delete process.env.APP_ENCRYPTION_KEY;
    givenStored("mercadopago", { accessToken: "APP_USR-legado" }, true);

    const { config } = await readPaymentMethodConfig("mercadopago");
    expect(config.accessToken).toBe("APP_USR-legado");
  });

  it("recusa gravar segredo sem APP_ENCRYPTION_KEY em vez de cair pra texto puro", async () => {
    delete process.env.APP_ENCRYPTION_KEY;
    givenStored("mercadopago", {});

    await expect(
      updatePaymentMethodConfig("mercadopago", { config: { accessToken: "APP_USR-1234" } })
    ).rejects.toThrow(/APP_ENCRYPTION_KEY/);
    expect(dbMock.paymentMethodConfig.update).not.toHaveBeenCalled();
  });

  it("não exige a chave para um método sem campo secreto", async () => {
    delete process.env.APP_ENCRYPTION_KEY;
    givenStored("pix", {});

    await updatePaymentMethodConfig("pix", {
      config: { key: "chave@exemplo.com", receiverName: "Fulano", receiverCity: "Recife" },
    });

    expect(lastStored().key).toBe("chave@exemplo.com");
  });

  it("falha com mensagem legível quando a chave foi trocada", async () => {
    givenStored("mercadopago", {});
    await updatePaymentMethodConfig("mercadopago", { config: { accessToken: "APP_USR-1234" } });

    process.env.APP_ENCRYPTION_KEY = "uma-chave-diferente-da-que-gravou";
    givenStored("mercadopago", lastStored(), true);

    await expect(readPaymentMethodConfig("mercadopago")).rejects.toThrow(
      /APP_ENCRYPTION_KEY é diferente/
    );
  });

  it("nenhum campo secret é gravado legível, para qualquer método", async () => {
    // Trava genérica: um campo secret novo passa a ser coberto sem editar o teste.
    for (const method of PAYMENT_METHODS) {
      givenStored(method.id, {});
      const filled = Object.fromEntries(method.fields.map((field) => [field.key, "valor-real"]));

      await updatePaymentMethodConfig(method.id, { config: filled });
      const stored = lastStored();

      for (const field of method.fields) {
        if (field.secret) expect(stored[field.key]).not.toBe("valor-real");
      }
    }
  });
});
