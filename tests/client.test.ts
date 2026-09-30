import { describe, expect, it, vi } from "vitest";
import { EhClient } from "../src/client.js";

describe("EhClient", () => {
  it("does not mistake JSON text containing challenge words for an HTML challenge", async () => {
    const fetchMock = vi.fn(async () => new Response(
      '{"gmetadata":[{"gid":1,"token":"123456789a","title":"Just a moment"}]}',
      { status: 200, headers: { "content-type": "text/html" } },
    ));
    const client = new EhClient({ fetch: fetchMock as typeof fetch });

    await expect(client.getGalleryMetadata([{ gid: 1, token: "123456789a" }]))
      .resolves.toEqual([{ gid: 1, token: "123456789a", title: "Just a moment" }]);
  });

  it("accepts the official API JSON even when served as text/html", async () => {
    const fetchMock = vi.fn(async () => new Response('{"gmetadata":[]}', {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    }));
    const client = new EhClient({ fetch: fetchMock as typeof fetch });

    await expect(client.getGalleryMetadata([{ gid: 1, token: "123456789a" }]))
      .resolves.toEqual([]);
  });

  it("rejects cookie values that could inject additional cookies", () => {
    expect(() => new EhClient({ cookies: { memberId: "42; injected=1" } }))
      .toThrow("EH_MEMBER_ID");
  });

  it("reports an HTML challenge returned by the JSON API", async () => {
    const fetchMock = vi.fn(async () => new Response(
      '<html><title>Just a moment...</title><div id="challenge-platform"></div></html>',
      { status: 200, headers: { "content-type": "text/html" } },
    ));
    const client = new EhClient({ fetch: fetchMock as typeof fetch });

    await expect(client.getGalleryMetadata([{ gid: 1, token: "123456789a" }]))
      .rejects.toThrow("Cloudflare challenge");
  });

  it("reports HTTP 509 as exhausted image quota", async () => {
    const fetchMock = vi.fn(async () => new Response("Bandwidth exceeded", { status: 509 }));
    const client = new EhClient({ fetch: fetchMock as typeof fetch, maxRetries: 0 });

    await expect(client.popular()).rejects.toThrow("image quota exhausted");
  });

  it("classifies HTTP 429 as a retryable rate-limit error", async () => {
    const fetchMock = vi.fn(async () => new Response("Too many requests", { status: 429 }));
    const client = new EhClient({ fetch: fetchMock as typeof fetch, maxRetries: 0 });

    await expect(client.popular()).rejects.toMatchObject({
      code: "RATE_LIMITED",
      retryable: true,
      status: 429,
      site: "e-hentai",
    });
  });

  it("classifies fetch failures as retryable network errors", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const client = new EhClient({
      fetch: fetchMock as typeof fetch,
      maxRetries: 0,
      cookies: { memberId: "42", passHash: "secret", igneous: "igneous" },
    });

    await expect(client.popular("exhentai")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      retryable: true,
      site: "exhentai",
      stage: "http-request",
    });
  });

  it("aborts requests after the configured timeout", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      await new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      });
      return new Response();
    });
    const client = new EhClient({ fetch: fetchMock as typeof fetch, timeoutMs: 1 });

    await expect(client.popular()).rejects.toThrow("timed out");
  });

  it("paces consecutive HTML page requests", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    try {
      const html = '<div id="i3"><img id="img" src="https://example.org/image.jpg"></div>';
      const fetchMock = vi.fn(async () => new Response(html, { status: 200 }));
      const client = new EhClient({ fetch: fetchMock as typeof fetch });
      const page = { gid: 1, pageToken: "123456789a", page: 1 };

      await client.getImagePage(page);
      const second = client.getImagePage({ ...page, page: 2, pageToken: "123456789b" });
      await vi.advanceTimersByTimeAsync(999);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      await second;
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails before network access when ExHentai credentials are incomplete", async () => {
    const fetchMock = vi.fn();
    const client = new EhClient({
      fetch: fetchMock as typeof fetch,
      cookies: { memberId: "42", passHash: "secret" },
    });

    await expect(client.search({ site: "exhentai", query: "test" }))
      .rejects.toMatchObject({
        code: "AUTH_REQUIRED",
        site: "exhentai",
        stage: "http-request",
      });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("classifies missing favorites credentials with site context", async () => {
    const client = new EhClient({ fetch: vi.fn() as typeof fetch });

    await expect(client.searchFavorites({ site: "exhentai" })).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
      retryable: false,
      site: "exhentai",
      stage: "favorites",
    });
  });

  it("classifies a favorites login page as rejected credentials", async () => {
    const fetchMock = vi.fn(async () => new Response(
      '<html><title>E-Hentai.org Login</title><form name="ipb_login_form"></form></html>',
      { status: 200 },
    ));
    const client = new EhClient({
      fetch: fetchMock as typeof fetch,
      cookies: { memberId: "42", passHash: "secret", igneous: "igneous" },
    });

    await expect(client.searchFavorites({ site: "exhentai" })).rejects.toMatchObject({
      code: "AUTH_REJECTED",
      retryable: false,
      site: "exhentai",
      stage: "favorites",
    });
  });

  it("classifies a malformed API payload with site context", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const client = new EhClient({ fetch: fetchMock as typeof fetch });

    await expect(client.getGalleryMetadata([{ gid: 1, token: "123456789a" }], "e-hentai"))
      .rejects.toMatchObject({
        code: "PARSE_ERROR",
        retryable: false,
        site: "e-hentai",
        stage: "api-response",
      });
  });

  it("uses an API limiter that stays within four calls per five seconds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    try {
      const fetchMock = vi.fn(async () => new Response(JSON.stringify({ gmetadata: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
      const client = new EhClient({ fetch: fetchMock as typeof fetch });

      await client.getGalleryMetadata([{ gid: 1, token: "123456789a" }]);
      const second = client.getGalleryMetadata([{ gid: 2, token: "123456789a" }]);
      await vi.advanceTimersByTimeAsync(1_249);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      await second;
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects more than 25 gallery metadata entries", async () => {
    const client = new EhClient({ fetch: vi.fn() as typeof fetch });
    const entries = Array.from({ length: 26 }, (_, i) => ({ gid: i + 1, token: "123456789a" }));
    await expect(client.getGalleryMetadata(entries)).rejects.toThrow("at most 25");
  });

  it("uses identity cookies without exposing them in results", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("cookie")).toContain("ipb_member_id=42");
      return new Response(JSON.stringify({ gmetadata: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const client = new EhClient({
      fetch: fetchMock as typeof fetch,
      cookies: { memberId: "42", passHash: "secret", igneous: "igneous" },
    });
    expect(await client.getGalleryMetadata([{ gid: 1, token: "123456789a" }])).toEqual([]);
  });
});
