import type { EhSite, IdentityCookies } from "../types.js";
import { EhError, networkErrorContext } from "../errors.js";
export { HttpStatusError } from "./request.js";
import { HttpStatusError, retryAfterMilliseconds, serializeCookies, sleepWithSignal } from "./request.js";

export interface HttpRequestOptions {
  fetch: typeof fetch;
  cookies?: IdentityCookies;
  userAgent: string;
  timeoutMs: number;
  maxRetries: number;
  retryBaseMs: number;
}

export function createHttpRequester(options: HttpRequestOptions): (url: string, site: EhSite, init?: RequestInit) => Promise<Response> {
  return async (url: string, site: EhSite, init: RequestInit = {}) => {
    if (site === "exhentai" && (!options.cookies?.memberId || !options.cookies.passHash || !options.cookies.igneous)) {
      throw new EhError("AUTH_REQUIRED", "ExHentai requires EH_MEMBER_ID, EH_PASS_HASH, and EH_IGNEOUS credentials", { retryable: false, site, stage: "http-request" });
    }
    const headers = new Headers(init.headers);
    headers.set("user-agent", options.userAgent);
    headers.set("accept", "text/html,application/json;q=0.9,*/*;q=0.8");
    const hostname = new URL(url).hostname.toLowerCase();
    const isEhentaiHost = hostname === "e-hentai.org" || hostname.endsWith(".e-hentai.org") || hostname === "exhentai.org" || hostname.endsWith(".exhentai.org");
    const cookie = isEhentaiHost ? serializeCookies(options.cookies, site) : null;
    if (cookie) headers.set("cookie", cookie);
    const timeoutSignal = AbortSignal.timeout(options.timeoutMs);
    const signal = init.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;
    for (let attempt = 0; ; attempt += 1) {
      let response: Response;
      try {
        response = await options.fetch(url, { ...init, headers, signal });
      } catch (error) {
        if (timeoutSignal.aborted) throw new EhError("NETWORK_ERROR", `E-Hentai request timed out after ${options.timeoutMs}ms`, { retryable: true, site, stage: "http-request", cause: error });
        throw networkErrorContext(error, { site, stage: "http-request" });
      }
      if (response.ok) return response;
      const retryable = response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504;
      if (retryable && attempt < options.maxRetries) {
        const delay = retryAfterMilliseconds(response) ?? options.retryBaseMs * (2 ** attempt);
        if (delay > 0) {
          try { await sleepWithSignal(delay, signal); } catch (error) {
            if (timeoutSignal.aborted) throw new EhError("NETWORK_ERROR", `E-Hentai request timed out after ${options.timeoutMs}ms`, { retryable: true, site, stage: "http-request", cause: error });
            throw networkErrorContext(error, { site, stage: "http-request" });
          }
        }
        continue;
      }
      throw new HttpStatusError(site, response.status, response.statusText);
    }
  };
}
