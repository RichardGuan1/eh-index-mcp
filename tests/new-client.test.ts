import { describe, expect, it, vi } from "vitest";
import { EhClient } from "../src/client.js";
import { SerialRateLimiter } from "../src/rate-limiter.js";

const noWait = () => new SerialRateLimiter(0);
const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { "content-type": "text/html" },
});

describe("extended EhClient workflows", () => {
  it("searches by an exact SHA-1 hash", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      expect(new URL(String(url)).searchParams.get("f_shash")).toBe("a".repeat(40));
      return new Response('<html><p>No hits found</p></html>');
    });
    const client = new EhClient({ fetch: fetchMock as typeof fetch, searchLimiter: noWait() });
    await expect(client.searchByHash("a".repeat(40))).resolves.toEqual({ galleries: [], prev: null, next: null });
  });

  it("preserves duplicate and per-entry error metadata when the API deduplicates rows", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      expect(request.gidlist).toEqual([[1, "123456789a"], [2, "123456789a"]]);
      return jsonResponse({ gmetadata: [
        { gid: 1, token: "123456789a" },
        { gid: 2, error: "Key missing" },
      ] });
    });
    const client = new EhClient({ fetch: fetchMock as typeof fetch, apiLimiter: noWait() });
    const refs = [{ gid: 1, token: "123456789a" }, { gid: 2, token: "123456789a" }, { gid: 1, token: "123456789a" }];
    const result = await client.getGalleryMetadataBatch(refs);
    expect(result).toHaveLength(3);
    expect(result[1]).toEqual({ gid: 2, error: "Key missing" });
    expect(result[0]).toEqual(result[2]);
  });

  it("batches metadata in groups of 25 and preserves result order", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      expect(request.gidlist.length).toBeLessThanOrEqual(25);
      return jsonResponse({ gmetadata: request.gidlist.map(([gid, token]: [number, string]) => ({ gid, token })) });
    });
    const client = new EhClient({ fetch: fetchMock as typeof fetch, apiLimiter: noWait() });
    const refs = Array.from({ length: 52 }, (_, i) => ({ gid: i + 1, token: "123456789a" }));
    const result = await client.getGalleryMetadataBatch(refs);
    expect(result.map((item) => item.gid)).toEqual(refs.map((item) => item.gid));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("restores input order when the metadata API reorders unique rows", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      return jsonResponse({
        gmetadata: [...request.gidlist].reverse().map(([gid, token]: [number, string]) => ({ gid, token })),
      });
    });
    const client = new EhClient({ fetch: fetchMock as typeof fetch, apiLimiter: noWait() });
    const result = await client.getGalleryMetadata([
      { gid: 1, token: "1111111111" },
      { gid: 2, token: "2222222222" },
    ]);

    expect(result.map((item) => item.gid)).toEqual([1, 2]);
  });

  it("preserves the ExHentai host in popular relative gallery links", async () => {
    const html = '<table class="itg"><tr><td class="gl3c glname"><a href="/g/7/123456789a/"><div class="glink">Popular</div></a></td></tr></table>';
    const client = new EhClient({
      cookies: { memberId: "42", passHash: "valid", igneous: "valid" },
      fetch: vi.fn(async () => new Response(html)) as typeof fetch,
      pageLimiter: noWait(),
    });

    await expect(client.popular("exhentai")).resolves.toMatchObject({
      galleries: [expect.objectContaining({ url: "https://exhentai.org/g/7/123456789a/" })],
    });
  });

  it("uses a configurable metadata cache TTL", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ gmetadata: [{ gid: 1, token: "123456789a" }] }));
    const client = new EhClient({ fetch: fetchMock as typeof fetch, apiLimiter: noWait(), longCacheTtlMs: 0 });
    const refs = [{ gid: 1, token: "123456789a" }];
    await client.getGalleryMetadata(refs);
    await client.getGalleryMetadata(refs);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("caches identical metadata calls without bypassing the first request", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ gmetadata: [{ gid: 1, token: "123456789a" }] }));
    const client = new EhClient({ fetch: fetchMock as typeof fetch, apiLimiter: noWait() });
    const refs = [{ gid: 1, token: "123456789a" }];
    await client.getGalleryMetadata(refs);
    await client.getGalleryMetadata(refs);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects expired favorite cookies when E-Hentai returns the login page", async () => {
    const loginHtml = '<html><title>E-Hentai.org Login</title><form name="ipb_login_form"></form></html>';
    const client = new EhClient({
      cookies: { memberId: "42", passHash: "expired" },
      fetch: vi.fn(async () => new Response(loginHtml)) as typeof fetch,
      searchLimiter: noWait(),
    });
    await expect(client.searchFavorites({})).rejects.toThrow("expired or were rejected");
  });

  it("reports ExHentai as reachable but unauthenticated when cookies are missing", async () => {
    const client = new EhClient({ fetch: vi.fn() as typeof fetch, pageLimiter: noWait() });
    await expect(client.checkAccess("exhentai")).resolves.toEqual(expect.objectContaining({
      site: "exhentai",
      reachable: true,
      authenticated: false,
      cloudflareChallenge: false,
    }));
  });

  it("validates supplied cookies against the authenticated favorites endpoint", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toContain("favorites.php");
      return new Response("<html><title>Favorites</title></html>");
    });
    const client = new EhClient({
      cookies: { memberId: "42", passHash: "valid" },
      fetch: fetchMock as typeof fetch,
      pageLimiter: noWait(),
    });
    await expect(client.checkAccess("e-hentai")).resolves.toEqual(expect.objectContaining({
      credentialsProvided: true,
      authenticated: true,
      message: expect.stringContaining("verified"),
    }));
  });

  it("reports rejected cookies as unauthenticated", async () => {
    const client = new EhClient({
      cookies: { memberId: "42", passHash: "expired" },
      fetch: vi.fn(async () => new Response('<html><title>E-Hentai.org Login</title><form name="ipb_login_form"></form></html>')) as typeof fetch,
      pageLimiter: noWait(),
    });
    await expect(client.checkAccess("e-hentai")).resolves.toEqual(expect.objectContaining({
      credentialsProvided: true,
      authenticated: false,
      message: expect.stringContaining("rejected"),
    }));
  });

  it("returns access diagnostics instead of throwing on network failure", async () => {
    const client = new EhClient({ fetch: vi.fn(async () => { throw new Error("offline"); }) as typeof fetch, pageLimiter: noWait() });
    await expect(client.checkAccess("e-hentai")).resolves.toEqual(expect.objectContaining({
      site: "e-hentai",
      reachable: null,
      authenticated: false,
      cloudflareChallenge: false,
      message: "offline",
    }));
  });

  it("fetches gallery details and torrent records", async () => {
    const detail = await (await import("node:fs/promises")).readFile(new URL("./fixtures/gallery-detail.html", import.meta.url), "utf8");
    const torrents = await (await import("node:fs/promises")).readFile(new URL("./fixtures/torrents.html", import.meta.url), "utf8");
    const fetchMock = vi.fn(async (url: string | URL | Request) => new Response(String(url).includes("gallerytorrents") ? torrents : detail));
    const client = new EhClient({ fetch: fetchMock as typeof fetch, pageLimiter: noWait() });
    const ref = { gid: 123, token: "123456789a" };
    await expect(client.getGalleryDetail(ref)).resolves.toEqual(expect.objectContaining({ gallery: expect.objectContaining({ gid: 123 }) }));
    await expect(client.getTorrents(ref)).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ id: 99 })]));
  });

  it("builds a deduplicated gallery chain from API links and detail versions", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes("api.php")) {
        const request = JSON.parse(String(init?.body));
        const list = request.gidlist as Array<[number, string]>;
        if (list.length === 1 && list[0]![0] === 123) return jsonResponse({ gmetadata: [{ gid: 123, token: "123456789a", first_gid: "100", first_key: "aaaaaaaaaa", current_gid: "124", current_key: "bbbbbbbbbb" }] });
        return jsonResponse({ gmetadata: list.map(([gid, token]) => ({ gid, token, title: `Gallery ${gid}` })) });
      }
      return new Response('<script>var gid=123;var token="123456789a";var average_rating=4;</script><div id="gn">G</div><div id="gdd"><table><tr><td>Length:</td><td>1 pages</td></tr></table></div><span id="rating_count">1</span><div id="taglist"><table></table></div><div id="gnd"><a href="https://e-hentai.org/g/124/bbbbbbbbbb/">New</a>, added 2026-01-01 00:00<br></div>');
    });
    const client = new EhClient({ fetch: fetchMock as typeof fetch, apiLimiter: noWait(), pageLimiter: noWait() });
    const result = await client.getGalleryChain({ gid: 123, token: "123456789a" });
    expect(result.map((entry) => entry.gid)).toEqual([100, 123, 124]);
  });

  it("keeps semantic gallery-chain order even when GIDs are not chronological", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes("api.php")) {
        const request = JSON.parse(String(init?.body));
        const list = request.gidlist as Array<[number, string]>;
        if (list.length === 1 && list[0]![0] === 500) {
          return jsonResponse({ gmetadata: [{ gid: 500, token: "5000000000", first_gid: "900", first_key: "9000000000", current_gid: "100", current_key: "1000000000" }] });
        }
        return jsonResponse({ gmetadata: list.map(([gid, token]) => ({ gid, token })) });
      }
      return new Response('<div id="gn">G</div><div id="gdd"><table><tr><td class="gdt1">Parent:</td><td class="gdt2"><a href="https://e-hentai.org/g/800/8000000000/">800</a></td></tr></table></div><div id="taglist"><table></table></div><div id="gnd"><a href="https://e-hentai.org/g/700/7000000000/">Middle</a>, added 2026-01-01 00:00<br><a href="https://e-hentai.org/g/100/1000000000/">Current</a>, added 2026-02-01 00:00<br></div>');
    });
    const client = new EhClient({ fetch: fetchMock as typeof fetch, apiLimiter: noWait(), pageLimiter: noWait() });
    const result = await client.getGalleryChain({ gid: 500, token: "5000000000" });
    expect(result.map((entry) => entry.gid)).toEqual([900, 800, 500, 700, 100]);
  });

  it("reports an API error instead of returning an empty gallery chain", async () => {
    const client = new EhClient({
      fetch: vi.fn(async () => jsonResponse({ gmetadata: [{ gid: 123, error: "Gallery not found" }] })) as typeof fetch,
      apiLimiter: noWait(),
    });
    await expect(client.getGalleryChain({ gid: 123, token: "123456789a" })).rejects.toThrow("Gallery not found");
  });

  it("retries transient rate-limit responses with backoff", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503, statusText: "Service Unavailable" }))
      .mockResolvedValueOnce(new Response('<html><p>No hits found</p></html>', { status: 200 }));
    const client = new EhClient({ fetch: fetchMock as typeof fetch, searchLimiter: noWait(), maxRetries: 1, retryBaseMs: 0 });
    await expect(client.search({ query: "retry-test" })).resolves.toEqual({ galleries: [], prev: null, next: null });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("applies the operation timeout while waiting to retry", async () => {
    const client = new EhClient({
      fetch: vi.fn(async () => new Response("busy", { status: 503 })) as typeof fetch,
      searchLimiter: noWait(),
      maxRetries: 1,
      retryBaseMs: 100,
      timeoutMs: 5,
    });
    await expect(client.search({ query: "timeout-during-backoff" })).rejects.toThrow("timed out");
  });

  it("keeps the detail failure reason in gallery-chain errors", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes("api.php")) return jsonResponse({ gmetadata: [{ gid: 123, token: "123456789a" }] });
      return new Response("missing", { status: 404, statusText: "Not Found" });
    });
    const client = new EhClient({ fetch: fetchMock as typeof fetch, apiLimiter: noWait(), pageLimiter: noWait(), maxRetries: 0 });
    await expect(client.getGalleryChain({ gid: 123, token: "123456789a" })).rejects.toThrow("resource not found");
  });

  it("classifies non-retryable HTTP errors", async () => {
    const client = new EhClient({
      fetch: vi.fn(async () => new Response("missing", { status: 404, statusText: "Not Found" })) as typeof fetch,
      searchLimiter: noWait(),
      maxRetries: 0,
    });
    await expect(client.search({ query: "missing" })).rejects.toThrow("resource not found");
  });
});
