export interface RateLimiterClock {
  now(): number;
  sleep(milliseconds: number): Promise<void>;
}

const defaultClock: RateLimiterClock = {
  now: () => Date.now(),
  sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
};

export class SerialRateLimiter {
  readonly #intervalMs: number;
  readonly #clock: RateLimiterClock;
  #lastStart = Number.NEGATIVE_INFINITY;
  #queue: Promise<unknown> = Promise.resolve();

  constructor(intervalMs: number, clock: RateLimiterClock = defaultClock) {
    this.#intervalMs = intervalMs;
    this.#clock = clock;
  }

  run<T>(operation: () => Promise<T>): Promise<T> {
    const scheduled = this.#queue.then(async () => {
      const remaining = this.#lastStart + this.#intervalMs - this.#clock.now();
      if (remaining > 0) await this.#clock.sleep(remaining);
      this.#lastStart = this.#clock.now();
      return operation();
    });
    this.#queue = scheduled.catch(() => undefined);
    return scheduled;
  }
}
