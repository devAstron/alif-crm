/**
 * Oddiy in-memory sliding-window rate limiter.
 * Railway'da yagona doimiy Node process ishlaydi, shuning uchun bu yetarli.
 * (Ko'p instansiyali muhitda Redis kerak bo'ladi.)
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

// Vaqti-vaqti bilan eskirgan yozuvlarni tozalash
let lastSweep = Date.now();
function sweep() {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, b] of store) {
    if (b.resetAt < now) store.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * @param key  Cheklov kaliti (masalan `login:${ip}` yoki `api:${apiKey}`)
 * @param limit  Oyna ichidagi maksimal so'rovlar
 * @param windowMs  Oyna davomiyligi (ms)
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  sweep();
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return { ok: true, remaining: limit - existing.count, retryAfterSec: 0 };
}
