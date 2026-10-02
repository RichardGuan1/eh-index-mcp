import type { EhSite, IdentityCookies } from "../types.js";
import { EhError } from "../errors.js";

export class HttpStatusError extends EhError {
  constructor(site: EhSite, status: number, readonly statusText: string) {
    const detail = status === 509
      ? "image quota exhausted; stop image requests and wait for quota recovery"
      : status === 429
        ? "rate limited; retry later or reduce request frequency"
      : status === 503
        ? "service unavailable or IP-level rate limit; retry later"
        : status === 401
          ? "authentication required or expired"
          : status === 403
            ? "access denied; verify account permissions and cookies"
            : status === 404
              ? "resource not found or no longer available"
              : statusText || "request failed";
    const code = status === 401
      ? "AUTH_REQUIRED"
      : status === 403
        ? "AUTH_REJECTED"
        : status === 404
          ? "NOT_FOUND"
          : status === 429 || status === 509
            ? "RATE_LIMITED"
            : "UPSTREAM_ERROR";
    super(code, `E-Hentai HTTP ${status}: ${detail}`, {
      retryable: status === 429 || status === 502 || status === 503 || status === 504,
      site,
      stage: "http-request",
      status,
    });
    this.name = "HttpStatusError";
  }
}

export function retryAfterMilliseconds(response: Response): number | null {
  const value = response.headers.get("retry-after");
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}

export function sleepWithSignal(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function readTextWithLimit(response: Response, maxBytes: number, label: string): Promise<string> {
  const contentLengthHeader = response.headers.get("content-length");
  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new Error(`${label} exceeds 8 MiB`);
    }
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new Error(`${label} exceeds 8 MiB`);
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export function serializeCookies(cookies: IdentityCookies | undefined, site: EhSite): string | null {
  if (!cookies) return null;
  const values: Array<[string, string | undefined]> = [
    ["ipb_member_id", cookies.memberId],
    ["ipb_pass_hash", cookies.passHash],
    ["igneous", site === "exhentai" ? cookies.igneous : undefined],
    ["cf_clearance", cookies.cfClearance],
    ["nw", "1"],
  ];
  const serialized = values.filter((entry): entry is [string, string] => Boolean(entry[1])).map(([key, value]) => `${key}=${value}`).join("; ");
  return serialized || null;
}
