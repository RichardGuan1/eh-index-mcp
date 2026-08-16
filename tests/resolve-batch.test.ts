import { describe, expect, it, vi } from "vitest";
import { EhClient } from "../src/client.js";
import { SerialRateLimiter } from "../src/rate-limiter.js";

const noWait = () => new SerialRateLimiter(0);

describe("batch gallery-token resolution", () => {
  it("rejects an empty batch before network access", async () => {
    const fetchMock = vi.fn();
    const client = new EhClient({ fetch: fetchMock as typeof fetch, apiLimiter: noWait() });

    await expect(client.resolveGalleryTokensBatch([])).rejects.toThrow("between 1 and 500");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects more than 500 entries before network access", async () => {
    const fetchMock = vi.fn();
    const client = new EhClient({ fetch: fetchMock as typeof fetch, apiLimiter: noWait() });
    const pages = Array.from({ length: 501 }, (_, index) => ({
      gid: index + 1,
      pageToken: (index + 1).toString(16).padStart(10, "0"),
      page: 1,
    }));

    await expect(client.resolveGalleryTokensBatch(pages)).rejects.toThrow("between 1 and 500");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("chunks at 25 entries and preserves duplicate and error rows", async () => {
    const batchSizes: number[] = [];
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      const pages = request.pagelist as Array<[number, string, number]>;
      batchSizes.push(pages.length);
      const unique = [...new Map(pages.map((page) => [`${page[0]}:${page[1]}:${page[2]}`, page])).values()];
      return new Response(JSON.stringify({ tokenlist: unique.map(([gid, pageToken, page]) => page === 2
        ? { gid, pageToken, page, error: "File not found" }
        : { gid, pageToken, page, token: gid.toString(16).padStart(10, "0") }) }));
    });
    const client = new EhClient({ fetch: fetchMock as typeof fetch, apiLimiter: noWait() });
    const pages = Array.from({ length: 25 }, (_, index) => ({
      gid: index + 1,
      pageToken: (index + 1).toString(16).padStart(10, "0"),
      page: index + 1,
    }));
    pages.push({ ...pages[0]! }, { gid: 99, pageToken: "9999999999", page: 2 });

    const result = await client.resolveGalleryTokensBatch(pages);

    expect(batchSizes).toEqual([25, 1]);
    expect(result).toHaveLength(27);
    expect(result[0]).toEqual(result[25]);
    expect(result[26]).toEqual({ gid: 99, pageToken: "9999999999", page: 2, error: "File not found" });
  });

  it("rejects token rows that belong to a different gallery", async () => {
    const client = new EhClient({
      fetch: vi.fn(async () => new Response(JSON.stringify({
        tokenlist: [{ gid: 2, token: "2222222222" }],
      }))) as typeof fetch,
      apiLimiter: noWait(),
    });

    await expect(client.resolveGalleryTokensBatch([
      { gid: 1, pageToken: "1111111111", page: 1 },
    ])).rejects.toThrow("mismatched gallery token row");
  });
});