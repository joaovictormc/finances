import { Redis } from "ioredis";

export const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: false,
});

// Sem este listener, um erro de conexão (Redis fora do ar) emite um evento 'error'
// não tratado e derruba o processo. Com ele, a API continua de pé — login/cadastro
// não dependem do Redis (apenas filas de e-mail/bot ficam indisponíveis até reconectar).
redis.on("error", (err) => {
  console.error("[redis] erro de conexão:", err.message);
});
