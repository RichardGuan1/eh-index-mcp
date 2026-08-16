export interface CacheClock {
  now(): number;
}

interface CacheEntry {
  expiresAt: number;
  value?: unknown;
  promise?: Promise<unknown>;
}

export class AsyncTtlCache {
  readonly #clock: CacheClock;
  readonly #entries = new Map<string, CacheEntry>();

  constructor(clock: CacheClock = { now: () => Date.now() }) {
    this.#clock = clock;
  }

  getOrLoad<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const existing = this.#entries.get(key);
    if (existing && (existing.promise || existing.expiresAt > this.#clock.now())) {
      return existing.promise ? existing.promise as Promise<T> : Promise.resolve(existing.value as T);
    }

    const entry: CacheEntry = { expiresAt: this.#clock.now() + ttlMs };
    const promise = loader().then((value) => {
      entry.value = value;
      entry.expiresAt = this.#clock.now() + ttlMs;
      delete entry.promise;
      return value;
    }).catch((error: unknown) => {
      if (this.#entries.get(key) === entry) this.#entries.delete(key);
      throw error;
    });
    entry.promise = promise;
    this.#entries.set(key, entry);
    return promise;
  }

  clear(): void {
    this.#entries.clear();
  }
}