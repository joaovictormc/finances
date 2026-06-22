// Cria a conta admin automaticamente em dev/testes, lendo credenciais do .env.
// Se a conta já existir, sincroniza a senha do credential account com ADMIN_PASSWORD
// (útil quando a senha guardada no banco ficou fora de sincronia com o .env local).
// Ativado só com ADMIN_BOOTSTRAP="true" — não roda nada se a env não estiver setada.
export async function bootstrapAdmin(port: number) {
  if (process.env.ADMIN_BOOTSTRAP !== "true") return;

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("[bootstrap-admin] ADMIN_BOOTSTRAP=true mas ADMIN_EMAIL/ADMIN_PASSWORD não definidos.");
    return;
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res = await fetch(`http://localhost:${port}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: appUrl },
      body: JSON.stringify({ email, password, name: "Admin" }),
    });

    if (res.ok) {
      console.log(`[bootstrap-admin] Conta admin criada: ${email}`);
      await ensureAdminRole(email);
      return;
    }

    const body = await res.json().catch(() => ({}));
    if (body?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" || body?.code === "USER_ALREADY_EXISTS") {
      await syncAdminPassword(email, password);
    } else {
      console.warn("[bootstrap-admin] Falha ao criar conta admin:", body);
    }

    await ensureAdminRole(email);
  } catch (err) {
    console.warn("[bootstrap-admin] Erro ao tentar criar conta admin:", err);
  }
}

async function ensureAdminRole(email: string) {
  const { db } = await import("@finances/db");
  await db.user.updateMany({ where: { email }, data: { role: "admin" } });
}

async function syncAdminPassword(email: string, password: string) {
  const { db } = await import("@finances/db");
  const { hashPassword } = await import("better-auth/crypto");

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    console.warn(`[bootstrap-admin] Conta ${email} não encontrada para sincronizar senha.`);
    return;
  }

  const account = await db.account.findFirst({ where: { userId: user.id, providerId: "credential" } });
  if (!account) {
    console.warn(`[bootstrap-admin] Conta ${email} não tem credential account (login social?), não sincronizei senha.`);
    return;
  }

  const newHash = await hashPassword(password);
  await db.account.update({ where: { id: account.id }, data: { password: newHash } });
  console.log(`[bootstrap-admin] Senha sincronizada para conta existente: ${email}`);
}
