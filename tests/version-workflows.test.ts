import { describe, expect, it, vi } from "vitest";
import { EhClient } from "../src/client.js";
import { SerialRateLimiter } from "../src/rate-limiter.js";

const noWait = () => new SerialRateLimiter(0);
const response = (value: unknown) => new Response(JSON.stringify(value));

describe("gallery version workflows", () => {
  it("compares metadata and tag changes between two versions", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      return response({ gmetadata: request.gidlist.map(([gid, token]: [number, string]) => gid === 1
        ? { gid, token, title: "Old", posted: "2025-01-01", filecount: "10", filesize: 1000, tags: ["female:a", "other:old"] }
        : { gid, token, title: "New", posted: "2026-01-01", filecount: "12", filesize: 1500, tags: ["female:a", "other:new"] }) });
    });
    const client = new EhClient({ fetch: fetchMock as typeof fetch, apiLimiter: noWait() });
    const result = await client.compareGalleryVersions(
      { gid: 1, token: "1111111111" },
      { gid: 2, token: "2222222222" },
    );
    expect(result.changes).toEqual({
      title: { before: "Old", after: "New" },
      posted: { before: "2025-01-01", after: "2026-01-01" },
      filecount: { before: 10, after: 12, delta: 2 },
      filesize: { before: 1000, after: 1500, delta: 500 },
      tagsAdded: ["other:new"],
      tagsRemoved: ["other:old"],
    });
  });

  it("compares one gallery to itself without relying on duplicate API rows", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      expect(request.gidlist).toEqual([[1, "1111111111"]]);
      return response({ gmetadata: [{
        gid: 1,
        token: "1111111111",
        title: "Same",
        posted: "2026-01-01",
        filecount: "10",
        filesize: 1000,
        tags: ["female:a"],
      }] });
    });
    const client = new EhClient({ fetch: fetchMock as typeof fetch, apiLimiter: noWait() });
    const result = await client.compareGalleryVersions(
      { gid: 1, token: "1111111111" },
      { gid: 1, token: "1111111111" },
    );
    expect(result.changes).toEqual({
      title: { before: "Same", after: "Same" },
      posted: { before: "2026-01-01", after: "2026-01-01" },
      filecount: { before: 10, after: 10, delta: 0 },
      filesize: { before: 1000, after: 1000, delta: 0 },
      tagsAdded: [],
      tagsRemoved: [],
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("returns the last semantic chain entry as the latest version", async () => {
    const client = new EhClient({ fetch: vi.fn() as typeof fetch });
    vi.spyOn(client, "getGalleryChain").mockResolvedValue([
      { gid: 1, token: "1111111111" },
      { gid: 3, token: "3333333333" },
      { gid: 2, token: "2222222222" },
    ]);
    await expect(client.findLatestGalleryVersion({ gid: 1, token: "1111111111" })).resolves.toEqual({ gid: 2, token: "2222222222" });
  });
});
