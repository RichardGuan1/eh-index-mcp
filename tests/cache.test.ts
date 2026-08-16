import { describe, expect, it, vi } from "vitest";
import { AsyncTtlCache } from "../src/cache.js";

describe("AsyncTtlCache", () => {
  it("deduplicates concurrent work and reuses successful values until expiry", async () => {
    let now = 1_000;
    let resolve!: (value: string) => void;
    const loader = vi.fn(() => new Promise<string>((done) => { resolve = done; }));
    const cache = new AsyncTtlCache({ now: () => now });

    const first = cache.getOrLoad("key", 100, loader);
    const second = cache.getOrLoad("key", 100, loader);
    expect(loader).toHaveBeenCalledTimes(1);
    resolve("value");
    await expect(Promise.all([first, second])).resolves.toEqual(["value", "value"]);
    await expect(cache.getOrLoad("key", 100, loader)).resolves.toBe("value");
    expect(loader).toHaveBeenCalledTimes(1);

    now = 1_101;
    const expired = cache.getOrLoad("key", 100, async () => "new");
    await expect(expired).resolves.toBe("new");
  });

  it("does not cache rejected work", async () => {
    const cache = new AsyncTtlCache();
    await expect(cache.getOrLoad("key", 100, async () => { throw new Error("fail"); })).rejects.toThrow("fail");
    await expect(cache.getOrLoad("key", 100, async () => "recovered")).resolves.toBe("recovered");
  });
});
