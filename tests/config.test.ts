import { describe, expect, it } from "vitest";
import { clientOptionsFromEnvironment } from "../src/config.js";

describe("environment client configuration", () => {
  it("parses retry, rate-limit, timeout, and cache settings", () => {
    expect(clientOptionsFromEnvironment({
      EH_TIMEOUT_MS: "12000",
      EH_MAX_RETRIES: "4",
      EH_RETRY_BASE_MS: "2500",
      EH_SEARCH_INTERVAL_MS: "3500",
      EH_PAGE_INTERVAL_MS: "1500",
      EH_API_INTERVAL_MS: "1600",
      EH_SHORT_CACHE_TTL_MS: "10000",
      EH_POPULAR_CACHE_TTL_MS: "20000",
      EH_LONG_CACHE_TTL_MS: "60000",
    })).toEqual({
      timeoutMs: 12000,
      maxRetries: 4,
      retryBaseMs: 2500,
      searchIntervalMs: 3500,
      pageIntervalMs: 1500,
      apiIntervalMs: 1600,
      shortCacheTtlMs: 10000,
      popularCacheTtlMs: 20000,
      longCacheTtlMs: 60000,
    });
  });

  it("rejects invalid numeric settings instead of silently using defaults", () => {
    expect(() => clientOptionsFromEnvironment({ EH_MAX_RETRIES: "-1" })).toThrow("EH_MAX_RETRIES");
    expect(() => clientOptionsFromEnvironment({ EH_TIMEOUT_MS: "1.5" })).toThrow("EH_TIMEOUT_MS");
  });
});
