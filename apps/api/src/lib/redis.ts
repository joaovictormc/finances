import { Redis } from "ioredis";

export const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: false,
});

// Redis fora do ar: o ioredis tenta reconectar sem parar, e cada fila e worker do
// BullMQ tem a própria conexão. Sem tratamento, cada tentativa vira um stack trace
// (dezenas por minuto) e o erro que importa some no meio. Aqui: uma linha na
// primeira falha, repetida no máximo a cada minuto, e um aviso quando volta.
const LOG_EVERY_MS = 60_000;
let lastLoggedAt = 0;
let failing = false;

export function logRedisError(err: Error) {
  const now = Date.now();
  if (!failing || now - lastLoggedAt >= LOG_EVERY_MS) {
    console.error(
      `[redis] sem conexão com ${redisHost()} (${err.message}). Filas, e-mails e limites de uso ficam parados até reconectar.`
    );
    lastLoggedAt = now;
  }
  failing = true;
}

function redisHost(): string {
  try {
    const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
    return `${url.hostname}:${url.port || "6379"}`;
  } catch {
    return "REDIS_URL inválido";
  }
}

/** Liga o tratamento acima a uma fila ou worker do BullMQ (que repassam os erros da conexão). */
export function quietRedisErrors(emitter: { on(event: "error", listener: (err: Error) => void): unknown }) {
  emitter.on("error", logRedisError);
}

// Sem este listener, um erro de conexão emite um evento 'error' não tratado e
// derruba o processo. Com ele, a API continua de pé.
redis.on("error", logRedisError);
redis.on("ready", () => {
  if (failing) console.log(`[redis] conexão restabelecida com ${redisHost()}.`);
  failing = false;
});
