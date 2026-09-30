import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { isAbsolute, resolve } from "node:path";
import type {
  AccessDiagnostics,
  AllGalleryPagesResult,
  ArchiveOptionsResult,
  EhSite,
  FavoriteCategoriesResult,
  FavoriteDetailResult,
  FavoritesOptions,
  FileSearchResult,
  GalleryBatchSearchOptions,
  GalleryBatchSearchResult,
  GalleryDetailResult,
  GalleryCommentsResult,
  GalleryListResult,
  GalleryMetadata,
  GalleryPagesResult,
  GalleryRef,
  GalleryTorrent,
  GalleryTokenResolution,
  GalleryVersionComparison,
  GalleryWorkSearchOptions,
  GalleryWorkSearchResult,
  IdentityCookies,
  ImagePageResult,
  PageRef,
  SearchOptions,
  SimilarGallerySearchResult,
  TagDefinitionResult,
  TagTranslationDatabase,
  TagTranslationSearchResult,
} from "./types.js";
import { apiUrl, buildFavoritesUrl, buildHashSearchUrl, buildSearchUrl, buildWatchedUrl, galleryTorrentsUrl, galleryUrl, pageUrl } from "./urls.js";
import { assertNotChallengePage, parseArchiveOptions, parseFavoriteCategories, parseFavoriteDetail, parseGalleryComments, parseGalleryDetail, parseGalleryList, parseGalleryPages, parseImagePage, parseTagDefinition, parseTorrents } from "./parsers.js";
import { SerialRateLimiter } from "./rate-limiter.js";
import { AsyncTtlCache } from "./cache.js";
import { parseTagTranslationDatabase, searchTranslatedTags } from "./tag-translations.js";
import { organizeGalleryWorks } from "./gallery-works.js";
import { extractSimilarGalleryTitle } from "./gallery-title.js";
import { VERSION } from "./version.js";
import { EhError, networkErrorContext } from "./errors.js";

const TAG_TRANSLATION_DATABASE_URL = "https://raw.githubusercontent.com/EhTagTranslation/Database/release/db.text.json";
const TAG_TRANSLATION_CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const TAG_TRANSLATION_MAX_BYTES = 8 * 1024 * 1024;

function quoteSearchValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /["\r\n]/u.test(trimmed)) throw new Error("Similar-gallery search value is invalid");
  return `"${trimmed}"`;
}

export interface EhClientOptions {
  fetch?: typeof fetch;
  cookies?: IdentityCookies;
  userAgent?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseMs?: number;
  searchIntervalMs?: number;
  pageIntervalMs?: number;
  apiIntervalMs?: number;
  shortCacheTtlMs?: number;
  popularCacheTtlMs?: number;
  longCacheTtlMs?: number;
  maxLocalFileBytes?: number;
  searchLimiter?: SerialRateLimiter;
  pageLimiter?: SerialRateLimiter;
  apiLimiter?: SerialRateLimiter;
}

class HttpStatusError extends EhError {
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

function retryAfterMilliseconds(response: Response): number | null {
  const value = response.headers.get("retry-after");
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}

function sleepWithSignal(milliseconds: number, signal: AbortSignal): Promise<void> {
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

async function readTextWithLimit(response: Response, maxBytes: number, label: string): Promise<string> {
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

function isLoginPage(html: string): boolean {
  return /<title>\s*E-Hentai\.org Login\s*<\/title>|name=["']ipb_login_form["']/i.test(html);
}

function authRejected(message: string, site: EhSite, stage: string): EhError {
  return new EhError("AUTH_REJECTED", message, { retryable: false, site, stage });
}

function authRequired(message: string, site: EhSite, stage: string): EhError {
  return new EhError("AUTH_REQUIRED", message, { retryable: false, site, stage });
}

function validateCookies(cookies: IdentityCookies | undefined): void {
  if (!cookies) return;
  const values: Array<[string, string | undefined]> = [
    ["EH_MEMBER_ID", cookies.memberId],
    ["EH_PASS_HASH", cookies.passHash],
    ["EH_IGNEOUS", cookies.igneous],
    ["EH_CF_CLEARANCE", cookies.cfClearance],
  ];
  for (const [name, value] of values) {
    if (value && !/^[A-Za-z0-9._~-]+$/.test(value)) {
      throw new Error(`${name} contains characters that are unsafe in a Cookie header`);
    }
  }
}

function serializeCookies(cookies: IdentityCookies | undefined, site: EhSite): string | null {
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

export class EhClient {
  readonly #fetch: typeof fetch;
  readonly #cookies?: IdentityCookies;
  readonly #userAgent: string;
  readonly #timeoutMs: number;
  readonly #maxRetries: number;
  readonly #retryBaseMs: number;
  readonly #searchLimiter: SerialRateLimiter;
  readonly #pageLimiter: SerialRateLimiter;
  readonly #apiLimiter: SerialRateLimiter;
  readonly #cache = new AsyncTtlCache();
  readonly #shortCacheTtlMs: number;
  readonly #popularCacheTtlMs: number;
  readonly #longCacheTtlMs: number;
  readonly #maxLocalFileBytes: number;

  constructor(options: EhClientOptions = {}) {
    validateCookies(options.cookies);
    this.#fetch = options.fetch ?? fetch;
    this.#cookies = options.cookies;
    this.#userAgent = options.userAgent ?? `eh-index-mcp/${VERSION}`;
    this.#timeoutMs = options.timeoutMs ?? 30_000;
    this.#maxRetries = options.maxRetries ?? 2;
    this.#retryBaseMs = options.retryBaseMs ?? 1_000;
    this.#searchLimiter = options.searchLimiter ?? new SerialRateLimiter(options.searchIntervalMs ?? 3_000);
    this.#pageLimiter = options.pageLimiter ?? new SerialRateLimiter(options.pageIntervalMs ?? 1_000);
    this.#apiLimiter = options.apiLimiter ?? new SerialRateLimiter(options.apiIntervalMs ?? 1_250);
    this.#shortCacheTtlMs = options.shortCacheTtlMs ?? 30_000;
    this.#popularCacheTtlMs = options.popularCacheTtlMs ?? 60_000;
    this.#longCacheTtlMs = options.longCacheTtlMs ?? 300_000;
    this.#maxLocalFileBytes = options.maxLocalFileBytes ?? 32 * 1024 * 1024;
  }

  #cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    return ttlMs > 0 ? this.#cache.getOrLoad(key, ttlMs, loader) : loader();
  }

  async #request(url: string, site: EhSite, init: RequestInit = {}): Promise<Response> {
    if (site === "exhentai" && (!this.#cookies?.memberId || !this.#cookies.passHash || !this.#cookies.igneous)) {
      throw new EhError("AUTH_REQUIRED", "ExHentai requires EH_MEMBER_ID, EH_PASS_HASH, and EH_IGNEOUS credentials", {
        retryable: false,
        site,
        stage: "http-request",
      });
    }
    const headers = new Headers(init.headers);
    headers.set("user-agent", this.#userAgent);
    headers.set("accept", "text/html,application/json;q=0.9,*/*;q=0.8");
    const hostname = new URL(url).hostname.toLowerCase();
    const isEhentaiHost = hostname === "e-hentai.org" || hostname.endsWith(".e-hentai.org")
      || hostname === "exhentai.org" || hostname.endsWith(".exhentai.org");
    const cookie = isEhentaiHost ? serializeCookies(this.#cookies, site) : null;
    if (cookie) headers.set("cookie", cookie);

    const timeoutSignal = AbortSignal.timeout(this.#timeoutMs);
    const signal = init.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;
    for (let attempt = 0; ; attempt += 1) {
      let response: Response;
      try {
        response = await this.#fetch(url, { ...init, headers, signal });
      } catch (error) {
        if (timeoutSignal.aborted) {
          throw new EhError("NETWORK_ERROR", `E-Hentai request timed out after ${this.#timeoutMs}ms`, {
            retryable: true,
            site,
            stage: "http-request",
            cause: error,
          });
        }
        throw networkErrorContext(error, { site, stage: "http-request" });
      }
      if (response.ok) return response;
      const retryable = response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504;
      if (retryable && attempt < this.#maxRetries) {
        const delay = retryAfterMilliseconds(response) ?? this.#retryBaseMs * (2 ** attempt);
        if (delay > 0) {
          try {
            await sleepWithSignal(delay, signal);
          } catch (error) {
            if (timeoutSignal.aborted) {
              throw new EhError("NETWORK_ERROR", `E-Hentai request timed out after ${this.#timeoutMs}ms`, {
                retryable: true,
                site,
                stage: "http-request",
                cause: error,
              });
            }
            throw networkErrorContext(error, { site, stage: "http-request" });
          }
        }
        continue;
      }
      throw new HttpStatusError(site, response.status, response.statusText);
    }
  }

  async #readJson<T>(response: Response, site: EhSite): Promise<T> {
    const text = await response.text();
    try {
      return JSON.parse(text) as T;
    } catch (error) {
      assertNotChallengePage(text, site);
      throw new EhError("PARSE_ERROR", "E-Hentai API returned malformed JSON", {
        retryable: false,
        site,
        stage: "api-json",
        cause: error,
      });
    }
  }

  async getGalleryMetadata(entries: GalleryRef[], site: EhSite = "e-hentai"): Promise<GalleryMetadata[]> {
    if (entries.length === 0) return [];
    if (entries.length > 25) throw new Error("Gallery metadata accepts at most 25 entries per request");
    const refKey = ({ gid, token }: GalleryRef) => `${gid}:${token.toLowerCase()}`;
    const uniqueEntries = [...new Map(entries.map((entry) => [refKey(entry), entry])).values()];
    const key = `gdata:${site}:${JSON.stringify(uniqueEntries)}`;
    const metadata = await this.#cached(key, this.#longCacheTtlMs, () => this.#apiLimiter.run(async () => {
      const response = await this.#request(apiUrl(site), site, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method: "gdata", gidlist: uniqueEntries.map(({ gid, token }) => [gid, token]), namespace: 1 }),
      });
      const body = await this.#readJson<{ gmetadata?: GalleryMetadata[]; error?: string }>(response, site);
      if (body.error) throw new EhError("UPSTREAM_ERROR", `E-Hentai API error: ${body.error}`, {
        retryable: false,
        site,
        stage: "api-response",
      });
      if (!Array.isArray(body.gmetadata)) throw new EhError("PARSE_ERROR", "E-Hentai API returned malformed gallery metadata", {
        retryable: false,
        site,
        stage: "api-response",
      });
      return body.gmetadata;
    }));
    const byKey = new Map(metadata.filter((entry) => entry.token).map((entry) => [refKey(entry as GalleryRef), entry]));
    const byGid = new Map(metadata.map((entry) => [Number(entry.gid), entry]));
    return entries.flatMap((entry) => {
      const result = byKey.get(refKey(entry)) ?? byGid.get(entry.gid);
      return result ? [result] : [];
    });
  }

  async getGalleryMetadataBatch(entries: GalleryRef[], site: EhSite = "e-hentai"): Promise<GalleryMetadata[]> {
    const results: GalleryMetadata[] = [];
    for (let index = 0; index < entries.length; index += 25) {
      results.push(...await this.getGalleryMetadata(entries.slice(index, index + 25), site));
    }
    return results;
  }

  async resolveGalleryToken(ref: PageRef, site: EhSite = "e-hentai"): Promise<GalleryRef> {
    return this.#apiLimiter.run(async () => {
      const response = await this.#request(apiUrl(site), site, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method: "gtoken", pagelist: [[ref.gid, ref.pageToken, ref.page]] }),
      });
      const body = await this.#readJson<{ tokenlist?: Array<GalleryRef & { error?: string }>; error?: string }>(response, site);
      if (body.error) throw new EhError("UPSTREAM_ERROR", `E-Hentai API error: ${body.error}`, {
        retryable: false,
        site,
        stage: "api-response",
      });
      const result = body.tokenlist?.[0];
      if (!result || result.error || !result.token) {
        throw new EhError("NOT_FOUND", `Could not resolve gallery token${result?.error ? `: ${result.error}` : ""}`, {
          retryable: false,
          site,
          stage: "api-response",
        });
      }
      if (Number(result.gid) !== ref.gid) {
        throw new EhError("PARSE_ERROR", `E-Hentai API returned a mismatched gallery token row: expected gid ${ref.gid}, received ${result.gid}`, {
          retryable: false,
          site,
          stage: "api-response",
        });
      }
      return { gid: result.gid, token: result.token };
    });
  }

  async resolveGalleryTokensBatch(entries: PageRef[], site: EhSite = "e-hentai"): Promise<GalleryTokenResolution[]> {
    if (entries.length < 1 || entries.length > 500) {
      throw new Error("Batch gallery-token resolution requires between 1 and 500 entries");
    }
    const entryKey = ({ gid, pageToken, page }: PageRef) => `${gid}:${pageToken.toLowerCase()}:${page}`;
    const uniqueEntries = [...new Map(entries.map((entry) => [entryKey(entry), entry])).values()];
    const resolved = new Map<string, GalleryTokenResolution>();
    for (let index = 0; index < uniqueEntries.length; index += 25) {
      const batch = uniqueEntries.slice(index, index + 25);
      const rows = await this.#apiLimiter.run(async () => {
        const response = await this.#request(apiUrl(site), site, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ method: "gtoken", pagelist: batch.map(({ gid, pageToken, page }) => [gid, pageToken, page]) }),
        });
        const body = await this.#readJson<{ tokenlist?: Array<{ gid: number; token?: string; error?: string }>; error?: string }>(response, site);
        if (body.error) throw new EhError("UPSTREAM_ERROR", `E-Hentai API error: ${body.error}`, {
          retryable: false,
          site,
          stage: "api-response",
        });
        if (!Array.isArray(body.tokenlist)) throw new EhError("PARSE_ERROR", "E-Hentai API returned malformed gallery tokens", {
          retryable: false,
          site,
          stage: "api-response",
        });
        return body.tokenlist;
      });
      batch.forEach((entry, offset) => {
        const row = rows[offset];
        if (row && Number(row.gid) !== entry.gid) {
          throw new EhError("PARSE_ERROR", `E-Hentai API returned a mismatched gallery token row: expected gid ${entry.gid}, received ${row.gid}`, {
            retryable: false,
            site,
            stage: "api-response",
          });
        }
        resolved.set(entryKey(entry), row?.token
          ? { ...entry, token: row.token }
          : { ...entry, error: row?.error ?? "E-Hentai API returned no result for this page" });
      });
    }
    return entries.map((entry) => resolved.get(entryKey(entry))!);
  }

  async search(options: SearchOptions): Promise<GalleryListResult> {
    const site = options.site ?? "e-hentai";
    const key = `search:${site}:${JSON.stringify(options)}`;
    return this.#cached(key, this.#shortCacheTtlMs, () => this.#searchLimiter.run(async () => {
      const response = await this.#request(buildSearchUrl(options), site);
      return parseGalleryList(await response.text(), site);
    }));
  }

  async searchBatch(options: GalleryBatchSearchOptions): Promise<GalleryBatchSearchResult> {
    const maxPages = options.maxPages ?? 5;
    if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 10) {
      throw new Error("maxPages must be an integer from 1 to 10");
    }
    const { maxPages: _maxPages, next: initialNext, ...searchOptions } = options;
    const galleries = new Map<string, GalleryListResult["galleries"][number]>();
    const seenCursors = new Set<string>();
    let next = initialNext ?? null;
    let pagesScanned = 0;

    for (; pagesScanned < maxPages; pagesScanned += 1) {
      if (next) {
        if (seenCursors.has(next)) throw new Error(`Search cursor repeated: ${next}`);
        seenCursors.add(next);
      }
      const page = await this.search({ ...searchOptions, ...(next ? { next } : {}) });
      for (const gallery of page.galleries) galleries.set(`${gallery.gid}:${gallery.token.toLowerCase()}`, gallery);
      next = page.next;
      if (!next) {
        pagesScanned += 1;
        break;
      }
    }

    return {
      galleries: [...galleries.values()],
      pagesScanned,
      resultCount: galleries.size,
      truncated: next !== null,
      next,
    };
  }

  async findSimilarGalleries(ref: GalleryRef, site: EhSite = "e-hentai"): Promise<SimilarGallerySearchResult> {
    const metadata = (await this.getGalleryMetadata([ref], site))[0];
    if (!metadata || metadata.error) {
      throw new Error(metadata?.error ?? "E-Hentai API returned no metadata for the gallery");
    }

    const title = extractSimilarGalleryTitle(metadata.title ?? metadata.title_jpn);
    let strategy: SimilarGallerySearchResult["strategy"];
    let query: string;
    if (title) {
      strategy = "title";
      query = quoteSearchValue(title);
    } else {
      const artist = metadata.tags?.find((tag) => tag.startsWith("artist:"))?.slice("artist:".length).trim();
      if (artist) {
        strategy = "artist";
        query = `artist:${quoteSearchValue(artist)}$`;
      } else if (metadata.uploader?.trim()) {
        strategy = "uploader";
        query = `uploader:${quoteSearchValue(metadata.uploader)}`;
      } else {
        throw new Error("Gallery has no extractable title, artist tag, or uploader for similar-gallery search");
      }
    }

    return { strategy, query, result: await this.search({ site, query }) };
  }

  async searchGalleryWorks(options: GalleryWorkSearchOptions): Promise<GalleryWorkSearchResult> {
    const maxPages = options.maxPages ?? 5;
    if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 10) {
      throw new Error("maxPages must be an integer from 1 to 10");
    }
    const site = options.site ?? "e-hentai";
    const { maxPages: _maxPages, next: initialNext, ...searchOptions } = options;
    const galleries: GalleryListResult["galleries"] = [];
    const seenCursors = new Set<string>();
    let next = initialNext ?? null;
    let pagesScanned = 0;

    for (; pagesScanned < maxPages; pagesScanned += 1) {
      if (next) {
        if (seenCursors.has(next)) throw new Error(`Search cursor repeated: ${next}`);
        seenCursors.add(next);
      }
      const page = await this.search({ ...searchOptions, site, ...(next ? { next } : {}) });
      galleries.push(...page.galleries);
      next = page.next;
      if (!next) {
        pagesScanned += 1;
        break;
      }
    }

    const refs = [...new Map(galleries.map((gallery) => [`${gallery.gid}:${gallery.token.toLowerCase()}`, {
      gid: gallery.gid,
      token: gallery.token,
    }])).values()];
    const organized = organizeGalleryWorks(await this.getGalleryMetadataBatch(refs, site), site);
    return {
      ...organized,
      pagesScanned,
      searchedGalleryCount: galleries.length,
      truncated: next !== null,
      next,
    };
  }

  async searchByHash(sha1: string, site: EhSite = "e-hentai"): Promise<GalleryListResult> {
    const key = `hash:${site}:${sha1.toLowerCase()}`;
    return this.#cached(key, this.#shortCacheTtlMs, () => this.#searchLimiter.run(async () => {
      const response = await this.#request(buildHashSearchUrl(sha1, site), site);
      return parseGalleryList(await response.text(), site);
    }));
  }

  async searchByFile(path: string, site: EhSite = "e-hentai"): Promise<FileSearchResult> {
    if (!isAbsolute(path)) throw new Error("Local image path must be an absolute path");
    const absolutePath = resolve(path);
    const information = await stat(absolutePath);
    if (!information.isFile()) throw new Error("Local image path must point to a regular file");
    if (information.size > this.#maxLocalFileBytes) {
      throw new Error(`Local image exceeds the ${this.#maxLocalFileBytes}-byte limit`);
    }
    const hash = createHash("sha1");
    for await (const chunk of createReadStream(absolutePath)) hash.update(chunk);
    const sha1 = hash.digest("hex");
    return { path: absolutePath, size: information.size, sha1, result: await this.searchByHash(sha1, site) };
  }

  async searchFavorites(options: FavoritesOptions): Promise<GalleryListResult> {
    const site = options.site ?? "e-hentai";
    if (!this.#cookies?.memberId || !this.#cookies.passHash) {
      throw authRequired("Favorites require EH_MEMBER_ID and EH_PASS_HASH credentials", site, "favorites");
    }
    const key = `favorites:${site}:${JSON.stringify(options)}`;
    return this.#cached(key, this.#shortCacheTtlMs, () => this.#searchLimiter.run(async () => {
      const response = await this.#request(buildFavoritesUrl(options), site);
      const html = await response.text();
      if (isLoginPage(html)) {
        throw authRejected("E-Hentai favorites credentials expired or were rejected; refresh EH_MEMBER_ID and EH_PASS_HASH", site, "favorites");
      }
      return parseGalleryList(html, site);
    }));
  }

  async searchWatched(options: SearchOptions): Promise<GalleryListResult> {
    const site = options.site ?? "e-hentai";
    if (!this.#cookies?.memberId || !this.#cookies.passHash) {
      throw authRequired("Watched searches require EH_MEMBER_ID and EH_PASS_HASH credentials", site, "watched");
    }
    const key = `watched:${site}:${JSON.stringify(options)}`;
    return this.#cached(key, this.#shortCacheTtlMs, () => this.#searchLimiter.run(async () => {
      const response = await this.#request(buildWatchedUrl(options), site);
      const html = await response.text();
      if (isLoginPage(html)) {
        throw authRejected("E-Hentai watched credentials expired or were rejected; refresh EH_MEMBER_ID and EH_PASS_HASH", site, "watched");
      }
      return parseGalleryList(html, site);
    }));
  }

  async getFavoriteCategories(site: EhSite = "e-hentai"): Promise<FavoriteCategoriesResult> {
    if (!this.#cookies?.memberId || !this.#cookies.passHash) {
      throw authRequired("Favorite categories require EH_MEMBER_ID and EH_PASS_HASH credentials", site, "favorites");
    }
    return this.#searchLimiter.run(async () => {
      const response = await this.#request(buildFavoritesUrl({ site, category: "all" }), site);
      const html = await response.text();
      if (isLoginPage(html)) throw authRejected("E-Hentai favorite credentials expired or were rejected", site, "favorites");
      return parseFavoriteCategories(html, site);
    });
  }

  async getFavoriteDetail(ref: GalleryRef, site: EhSite = "e-hentai"): Promise<FavoriteDetailResult> {
    if (!this.#cookies?.memberId || !this.#cookies.passHash) {
      throw authRequired("Favorite detail requires EH_MEMBER_ID and EH_PASS_HASH credentials", site, "favorites");
    }
    const host = site === "exhentai" ? "exhentai.org" : "e-hentai.org";
    const popupUrl = new URL(`https://${host}/gallerypopups.php`);
    popupUrl.search = new URLSearchParams({ gid: String(ref.gid), t: ref.token, act: "addfav" }).toString();
    const popupHtml = await this.#pageLimiter.run(async () => {
      const response = await this.#request(popupUrl.toString(), site);
      const html = await response.text();
      if (isLoginPage(html)) throw authRejected("E-Hentai favorite credentials expired or were rejected", site, "favorites");
      return html;
    });
    const listHtml = await this.#searchLimiter.run(async () => {
      const response = await this.#request(buildFavoritesUrl({ site, category: "all", query: `gid:${ref.gid}` }), site);
      const html = await response.text();
      if (isLoginPage(html)) throw authRejected("E-Hentai favorite credentials expired or were rejected", site, "favorites");
      return html;
    });
    return parseFavoriteDetail(popupHtml, listHtml, ref, site);
  }

  async popular(site: EhSite = "e-hentai"): Promise<GalleryListResult> {
    return this.#cached(`popular:${site}`, this.#popularCacheTtlMs, () => this.#pageLimiter.run(async () => {
      const response = await this.#request(`https://${site === "exhentai" ? "exhentai.org" : "e-hentai.org"}/popular`, site);
      return parseGalleryList(await response.text(), site);
    }));
  }

  async getGalleryDetail(ref: GalleryRef, site: EhSite = "e-hentai"): Promise<GalleryDetailResult> {
    return this.#cached(`detail:${site}:${ref.gid}:${ref.token}`, this.#longCacheTtlMs, () => this.#pageLimiter.run(async () => {
      const response = await this.#request(galleryUrl(ref, site), site);
      return parseGalleryDetail(await response.text(), ref, site);
    }));
  }

  async getGalleryComments(ref: GalleryRef, site: EhSite = "e-hentai", includeHidden = false): Promise<GalleryCommentsResult> {
    return this.#cached(`comments:${site}:${ref.gid}:${ref.token}:${includeHidden}`, this.#longCacheTtlMs, () => this.#pageLimiter.run(async () => {
      const url = new URL(galleryUrl(ref, site));
      if (includeHidden) url.searchParams.set("hc", "1");
      const response = await this.#request(url.toString(), site);
      return { comments: parseGalleryComments(await response.text(), site), includeHidden };
    }));
  }

  async getTorrents(ref: GalleryRef, site: EhSite = "e-hentai"): Promise<GalleryTorrent[]> {
    return this.#cached(`torrents:${site}:${ref.gid}:${ref.token}`, this.#longCacheTtlMs, () => this.#pageLimiter.run(async () => {
      const response = await this.#request(galleryTorrentsUrl(ref, site), site);
      return parseTorrents(await response.text(), site);
    }));
  }

  async getArchiveOptions(ref: GalleryRef, site: EhSite = "e-hentai"): Promise<ArchiveOptionsResult> {
    if (!this.#cookies?.memberId || !this.#cookies.passHash) {
      throw authRequired("Archive options require EH_MEMBER_ID and EH_PASS_HASH credentials", site, "archive");
    }
    return this.#pageLimiter.run(async () => {
      const host = site === "exhentai" ? "exhentai.org" : "e-hentai.org";
      const url = new URL(`https://${host}/archiver.php`);
      url.search = new URLSearchParams({ gid: String(ref.gid), token: ref.token }).toString();
      const response = await this.#request(url.toString(), site);
      const html = await response.text();
      if (isLoginPage(html)) throw authRejected("E-Hentai archive credentials expired or were rejected", site, "archive");
      return parseArchiveOptions(html, site);
    });
  }

  async lookupTagDefinition(tag: string): Promise<TagDefinitionResult> {
    const normalized = tag.trim();
    if (!normalized || normalized.length > 100 || /[\x00-\x1f\x7f]/.test(normalized)) {
      throw new Error("Tag name must contain 1-100 printable characters");
    }
    const slug = normalized.replace(/\s+/g, "_");
    const url = `https://ehwiki.org/wiki/${encodeURIComponent(slug)}`;
    return this.#cached(`tag-definition:${slug.toLowerCase()}`, this.#longCacheTtlMs, () => this.#pageLimiter.run(async () => {
      const response = await this.#request(url, "e-hentai");
      return parseTagDefinition(await response.text(), url);
    }));
  }

  async searchTranslatedTags(query: string, limit = 20): Promise<TagTranslationSearchResult> {
    const database = await this.#cached<TagTranslationDatabase>(
      "tag-translation-database",
      TAG_TRANSLATION_CACHE_TTL_MS,
      async () => {
        const response = await this.#request(TAG_TRANSLATION_DATABASE_URL, "e-hentai", {
          headers: { accept: "application/json" },
        });
        const text = await readTextWithLimit(
          response,
          TAG_TRANSLATION_MAX_BYTES,
          "EhTagTranslation database response",
        );
        let value: unknown;
        try {
          value = JSON.parse(text);
        } catch (error) {
          throw new Error("EhTagTranslation database returned malformed JSON", { cause: error });
        }
        return parseTagTranslationDatabase(value);
      },
    );
    return searchTranslatedTags(database, query, limit);
  }

  async checkAccess(site: EhSite = "e-hentai"): Promise<AccessDiagnostics> {
    const credentialsProvided = Boolean(this.#cookies?.memberId && this.#cookies.passHash && (site === "e-hentai" || this.#cookies.igneous));
    const probeUrl = credentialsProvided
      ? `https://${site === "exhentai" ? "exhentai.org" : "e-hentai.org"}/favorites.php`
      : `https://${site === "exhentai" ? "exhentai.org" : "e-hentai.org"}/`;
    try {
      const response = await this.#pageLimiter.run(() => this.#request(probeUrl, site));
      const html = await response.text();
      assertNotChallengePage(html, site);
      const rejected = credentialsProvided && isLoginPage(html);
      return {
        site,
        reachable: true,
        credentialsProvided,
        authenticated: credentialsProvided ? !rejected : false,
        cloudflareChallenge: false,
        status: response.status,
        message: rejected
          ? "Credentials were rejected or expired"
          : credentialsProvided
            ? "Authenticated access verified through favorites"
            : "Public access available; no credentials provided",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const authenticationRequired = /requires EH_MEMBER_ID|Favorites require/i.test(message);
      const authenticationRejected = /login page|credentials expired|credentials.*rejected/i.test(message);
      return {
        site,
        reachable: authenticationRequired || authenticationRejected ? true : null,
        credentialsProvided,
        authenticated: authenticationRejected ? false : credentialsProvided ? null : false,
        cloudflareChallenge: /Cloudflare challenge/i.test(message),
        status: error instanceof HttpStatusError ? error.status ?? null : null,
        message,
      };
    }
  }

  async getGalleryChain(ref: GalleryRef, site: EhSite = "e-hentai"): Promise<GalleryMetadata[]> {
    const root = (await this.getGalleryMetadata([ref], site))[0];
    if (!root) throw new Error(`Gallery chain lookup returned no entry for gid ${ref.gid}`);
    if (root.error) throw new Error(`Gallery chain lookup failed for gid ${ref.gid}: ${root.error}`);
    const candidates = new Map<number, GalleryRef>();
    const add = (gid: string | number | undefined, token: string | undefined) => {
      const numeric = Number(gid);
      if (Number.isInteger(numeric) && numeric > 0 && token && !candidates.has(numeric)) candidates.set(numeric, { gid: numeric, token });
    };
    let detail;
    try {
      detail = await this.getGalleryDetail(ref, site);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Gallery chain detail lookup failed for gid ${ref.gid}: ${reason}`, { cause: error });
    }
    add(root.first_gid, root.first_key);
    if (detail.gallery.parent) add(detail.gallery.parent.gid, detail.gallery.parent.token);
    add(root.gid, root.token ?? ref.token);
    for (const version of detail.newerVersions) add(version.gid, version.token);
    add(root.current_gid, root.current_key);
    return this.getGalleryMetadataBatch([...candidates.values()], site);
  }

  async findLatestGalleryVersion(ref: GalleryRef, site: EhSite = "e-hentai"): Promise<GalleryMetadata> {
    const chain = await this.getGalleryChain(ref, site);
    const latest = chain.at(-1);
    if (!latest) throw new Error(`Gallery version chain is empty for gid ${ref.gid}`);
    return latest;
  }

  async compareGalleryVersions(beforeRef: GalleryRef, afterRef: GalleryRef, site: EhSite = "e-hentai"): Promise<GalleryVersionComparison> {
    const sameGallery = beforeRef.gid === afterRef.gid && beforeRef.token.toLowerCase() === afterRef.token.toLowerCase();
    const metadata = await this.getGalleryMetadataBatch(sameGallery ? [beforeRef] : [beforeRef, afterRef], site);
    const before = metadata[0];
    const after = sameGallery ? before : metadata[1];
    if (!before || !after) throw new Error("Gallery version comparison returned incomplete metadata");
    if (before.error) throw new Error(`Before gallery metadata failed: ${before.error}`);
    if (after.error) throw new Error(`After gallery metadata failed: ${after.error}`);
    const numberValue = (value: string | number | undefined): number | null => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    };
    const beforeCount = numberValue(before.filecount);
    const afterCount = numberValue(after.filecount);
    const beforeSize = numberValue(before.filesize);
    const afterSize = numberValue(after.filesize);
    const beforeTags = new Set(before.tags ?? []);
    const afterTags = new Set(after.tags ?? []);
    return {
      before,
      after,
      changes: {
        title: { before: before.title ?? null, after: after.title ?? null },
        posted: { before: before.posted ?? null, after: after.posted ?? null },
        filecount: { before: beforeCount, after: afterCount, delta: beforeCount !== null && afterCount !== null ? afterCount - beforeCount : null },
        filesize: { before: beforeSize, after: afterSize, delta: beforeSize !== null && afterSize !== null ? afterSize - beforeSize : null },
        tagsAdded: [...afterTags].filter((tag) => !beforeTags.has(tag)).sort(),
        tagsRemoved: [...beforeTags].filter((tag) => !afterTags.has(tag)).sort(),
      },
    };
  }

  async getGalleryPages(ref: GalleryRef, site: EhSite = "e-hentai", previewPage = 0): Promise<GalleryPagesResult> {
    if (!Number.isInteger(previewPage) || previewPage < 0) throw new Error("Preview page must be a non-negative integer");
    return this.#cached(`pages:${site}:${ref.gid}:${ref.token}:${previewPage}`, this.#longCacheTtlMs, () => this.#pageLimiter.run(async () => {
      const url = new URL(galleryUrl(ref, site));
      if (previewPage > 0) url.searchParams.set("p", String(previewPage));
      const response = await this.#request(url.toString(), site);
      return parseGalleryPages(await response.text(), site);
    }));
  }

  async getAllGalleryPages(ref: GalleryRef, site: EhSite = "e-hentai", maxImages = 500): Promise<AllGalleryPagesResult> {
    if (!Number.isInteger(maxImages) || maxImages < 1) throw new Error("maxImages must be a positive integer");
    const first = await this.getGalleryPages(ref, site, 0);
    if (first.totalPages > maxImages) throw new Error(`Gallery has ${first.totalPages} images, which exceeds maxImages ${maxImages}`);
    const previewPageCount = Math.ceil(first.totalPages / 20);
    const batches = [first];
    for (let previewPage = 1; previewPage < previewPageCount; previewPage += 1) {
      batches.push(await this.getGalleryPages(ref, site, previewPage));
    }
    const pages = [...new Map(batches.flatMap((batch) => batch.pages).map((page) => [page.page, page])).values()]
      .sort((left, right) => left.page - right.page)
      .filter((page) => page.page <= first.totalPages);
    if (pages.length !== first.totalPages) {
      throw new Error(`Gallery page enumeration incomplete: expected ${first.totalPages}, received ${pages.length}`);
    }
    return { totalPages: first.totalPages, pages, previewPagesFetched: previewPageCount };
  }

  async getImagePage(ref: PageRef, site: EhSite = "e-hentai"): Promise<ImagePageResult> {
    return this.#cached(`image:${site}:${ref.gid}:${ref.pageToken}:${ref.page}`, this.#shortCacheTtlMs, () => this.#pageLimiter.run(async () => {
      const response = await this.#request(pageUrl(ref, site), site);
      return parseImagePage(await response.text(), site);
    }));
  }
}
