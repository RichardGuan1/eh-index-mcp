import { describe, expect, it, vi } from "vitest";
import { SerialRateLimiter } from "../src/rate-limiter.js";

describe("SerialRateLimiter", () => {
  it("waits for the remaining interval between operations", async () => {
    let now = 1_000;
    const sleep = vi.fn(async (milliseconds: number) => { now += milliseconds; });
    const limiter = new SerialRateLimiter(3_000, { now: () => now, sleep });

    await limiter.run(async () => "first");
    now += 500;
    await limiter.run(async () => "second");

    expect(sleep).toHaveBeenCalledWith(2_500);
  });
});
