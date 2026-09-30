const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  timeoutMs: number;
}

/**
 * fetch com até `attempts` tentativas e espera crescente em 429/5xx e falhas de rede.
 * Devolve a última resposta (mesmo com erro HTTP); só lança se a rede falhar em todas.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  { attempts = 3, baseDelayMs = 1500, timeoutMs }: RetryOptions,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (!RETRY_STATUS.has(res.status) || attempt === attempts) return res;
      await res.body?.cancel();
    } catch (err) {
      lastError = err;
      if (attempt === attempts) throw err;
    }
    await sleep(baseDelayMs * attempt);
  }
  throw lastError;
}

/** Garante intervalo mínimo entre chamadas (política de uso do Nominatim e do Overpass). */
export function createThrottle(minIntervalMs: number): () => Promise<void> {
  let next = 0;
  return async () => {
    const now = Date.now();
    const wait = Math.max(0, next - now);
    next = Math.max(now, next) + minIntervalMs;
    if (wait > 0) await sleep(wait);
  };
}
