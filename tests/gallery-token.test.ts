import { describe, expect, it, vi } from "vitest";
import { EhClient } from "../src/client.js";

describe("gallery token API", () => {
  it("resolves a gallery token from a one-based image page", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        method: "gtoken",
        pagelist: [[618395, "40bc07a79a", 11]],
      });
      return new Response(JSON.stringify({ tokenlist: [{ gid: 618395, token: "0439fa3666" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const client = new EhClient({ fetch: fetchMock as typeof fetch });
    await expect(client.resolveGalleryToken({ gid: 618395, pageToken: "40bc07a79a", page: 11 }))
      .resolves.toEqual({ gid: 618395, token: "0439fa3666" });
  });

  it("rejects a token row for a different gallery", async () => {
    const client = new EhClient({
      fetch: vi.fn(async () => new Response(JSON.stringify({
        tokenlist: [{ gid: 2, token: "2222222222" }],
      }))) as typeof fetch,
    });

    await expect(client.resolveGalleryToken({ gid: 1, pageToken: "1111111111", page: 1 }))
      .rejects.toThrow("mismatched gallery token row");
  });
});
