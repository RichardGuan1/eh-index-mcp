import type { EhClientOptions } from "./client.js";

type Environment = Record<string, string | undefined>;

const SETTINGS = {
  EH_TIMEOUT_MS: "timeoutMs",
  EH_MAX_RETRIES: "maxRetries",
  EH_RETRY_BASE_MS: "retryBaseMs",
  EH_SEARCH_INTERVAL_MS: "searchIntervalMs",
  EH_PAGE_INTERVAL_MS: "pageIntervalMs",
  EH_API_INTERVAL_MS: "apiIntervalMs",
  EH_SHORT_CACHE_TTL_MS: "shortCacheTtlMs",
  EH_POPULAR_CACHE_TTL_MS: "popularCacheTtlMs",
  EH_LONG_CACHE_TTL_MS: "longCacheTtlMs",
  EH_MAX_LOCAL_FILE_BYTES: "maxLocalFileBytes",
} as const satisfies Record<string, keyof EhClientOptions>;

export function clientOptionsFromEnvironment(environment: Environment): EhClientOptions {
  const options: EhClientOptions = {};
  for (const [variable, property] of Object.entries(SETTINGS) as Array<[keyof typeof SETTINGS, keyof EhClientOptions]>) {
    const raw = environment[variable];
    if (raw === undefined || raw === "") continue;
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${variable} must be a non-negative integer`);
    }
    Object.assign(options, { [property]: value });
  }
  return options;
}
