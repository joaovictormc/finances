-- Notificação push no celular: guarda o token do Expo por aparelho, para que a
-- API consiga avisar o usuário com o app fechado. Tabela e não coluna no perfil
-- porque a mesma conta pode estar em vários dispositivos.

CREATE TABLE "push_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "deviceName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- Unique no token: o mesmo aparelho reinstalando reaproveita a linha em vez de
-- duplicar, e trocar de conta no mesmo celular move o token de dono.
CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");

CREATE INDEX "push_tokens_userId_idx" ON "push_tokens"("userId");

ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
