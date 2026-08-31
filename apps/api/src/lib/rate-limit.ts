import { redis } from "./redis";

type RateLimitOptions = {
  /** Identificador do recurso limitado, ex: "assistant-message". */
  key: string;
  userId: string;
  /** Requisições permitidas dentro da janela. */
  max: number;
  windowSeconds: number;
};

/**
 * Limite por usuário com contador no Redis (INCR + EXPIRE na primeira chamada
 * da janela). Retorna `false` quando o limite foi estourado.
 *
 * Falha aberta de propósito: Redis fora do ar não pode impedir o usuário de
 * usar a aplicação. O limite existe contra abuso/laço de script, não como
 * controle de acesso — quem protege dado é o `requireAuth` e o gate de plano.
 */
export async function checkRateLimit({
  key,
  userId,
  max,
  windowSeconds,
}: RateLimitOptions): Promise<boolean> {
  try {
    const redisKey = `rate-limit:${key}:${userId}`;
    const requests = await redis.incr(redisKey);
    if (requests === 1) await redis.expire(redisKey, windowSeconds);
    return requests <= max;
  } catch {
    return true;
  }
}
