import { beforeEach, describe, expect, it, vi } from "vitest";

// `vi.hoisted` porque o factory do `vi.mock` roda antes das declarações do módulo.
const dbMock = vi.hoisted(() => ({
  userProfile: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  notification: { create: vi.fn(), update: vi.fn() },
}));
const sendEmailMock = vi.hoisted(() => vi.fn());

vi.mock("@finances/db", () => ({ db: dbMock, Prisma: {} }));
vi.mock("./email", () => ({ sendEmail: sendEmailMock }));

import { sendNotification } from "./notifications";

type CreateData = { channel: string; status: string; type: string; title: string };

function lastCreateData(): CreateData {
  const call = dbMock.notification.create.mock.calls.at(-1);
  if (!call) throw new Error("notification.create não foi chamado");
  return (call[0] as { data: CreateData }).data;
}

beforeEach(() => {
  dbMock.userProfile.findUnique.mockReset();
  dbMock.user.findUnique.mockReset();
  dbMock.notification.create.mockReset();
  dbMock.notification.update.mockReset();
  sendEmailMock.mockReset();

  dbMock.notification.create.mockResolvedValue({ id: "n1" });
  dbMock.user.findUnique.mockResolvedValue({ email: "pessoa@exemplo.com", name: "Fulano" });
});

const aviso = { type: "pix_checkout_pending", title: "Pix pendente", body: "detalhes" };

describe("sendNotification", () => {
  it("grava o aviso in-app mesmo com e-mail desligado", async () => {
    // Regressão principal: antes a linha só nascia se o e-mail estivesse
    // ligado, então quem desativou e-mail não recebia nada em canal nenhum.
    dbMock.userProfile.findUnique.mockResolvedValue({ notifyEmail: false, aiInsightsEnabled: true });

    await sendNotification("u1", aviso);

    expect(dbMock.notification.create).toHaveBeenCalledOnce();
    expect(lastCreateData().channel).toBe("inapp");
    expect(lastCreateData().status).toBe("sent");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("grava e também envia por e-mail quando o canal está ligado", async () => {
    dbMock.userProfile.findUnique.mockResolvedValue({ notifyEmail: true, aiInsightsEnabled: true });

    await sendNotification("u1", aviso);

    expect(dbMock.notification.create).toHaveBeenCalledOnce();
    expect(sendEmailMock).toHaveBeenCalledOnce();
  });

  it("assume os canais ligados quando não há perfil", async () => {
    dbMock.userProfile.findUnique.mockResolvedValue(null);

    await sendNotification("u1", aviso);

    expect(dbMock.notification.create).toHaveBeenCalledOnce();
    expect(sendEmailMock).toHaveBeenCalledOnce();
  });

  it("não avisa nada de IA para quem desligou insights", async () => {
    dbMock.userProfile.findUnique.mockResolvedValue({ notifyEmail: true, aiInsightsEnabled: false });

    await sendNotification("u1", { type: "budget_alert", title: "Orçamento", body: "estourou" });

    expect(dbMock.notification.create).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("mantém o aviso in-app quando o e-mail falha, registrando o erro na linha", async () => {
    dbMock.userProfile.findUnique.mockResolvedValue({ notifyEmail: true, aiInsightsEnabled: true });
    sendEmailMock.mockRejectedValue(new Error("Brevo fora do ar"));

    await sendNotification("u1", aviso);

    expect(dbMock.notification.create).toHaveBeenCalledOnce();
    const update = dbMock.notification.update.mock.calls.at(-1);
    expect((update?.[0] as { data: { error: string } }).data.error).toContain("Brevo fora do ar");
  });

  it("não tenta e-mail para usuário sem endereço, mas registra o aviso", async () => {
    dbMock.userProfile.findUnique.mockResolvedValue({ notifyEmail: true, aiInsightsEnabled: true });
    dbMock.user.findUnique.mockResolvedValue({ email: null, name: "Sem e-mail" });

    await sendNotification("u1", aviso);

    expect(dbMock.notification.create).toHaveBeenCalledOnce();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
