type Entry = { count: number; resetAt: number };

/**
 * Creates a fixed-window rate limiter backed by an in-memory Map.
 *
 * On Vercel, this is per-function-instance. Warm instances share state,
 * so this provides meaningful protection against single-source abuse.
 */
export function createRateLimiter(windowMs: number, max: number) {
  const store = new Map<string, Entry>();

  return function check(ip: string): { allowed: boolean; retryAfter: number } {
    const now = Date.now();
    const entry = store.get(ip);

    if (!entry || now >= entry.resetAt) {
      store.set(ip, { count: 1, resetAt: now + windowMs });
      pruneIfNeeded(store, now);
      return { allowed: true, retryAfter: 0 };
    }

    if (entry.count >= max) {
      return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
    }

    entry.count++;
    return { allowed: true, retryAfter: 0 };
  };
}

function pruneIfNeeded(store: Map<string, Entry>, now: number) {
  if (store.size <= 500) return;
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) store.delete(key);
  }
}

export function getIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"
  );
}
