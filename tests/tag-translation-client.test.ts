import { describe, expect, it, vi } from "vitest";
import { EhClient } from "../src/client.js";

const database = {
  repo: "https://github.com/EhTagTranslation/Database",
  head: { sha: "0123456789abcdef0123456789abcdef01234567" },
  version: 7,
  data: [{
    namespace: "mixed",
    data: {
      "ffm threesome": { name: "女男女3P", intro: "2 女 1 男。", links: "" },
      "mmf threesome": { name: "男女男3P", intro: "2 男 1 女。", links: "" },
    },
  }],
};

describe("translated tag client", () => {
  it("loads the official release without identity cookies and caches it", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://raw.githubusercontent.com/EhTagTranslation/Database/release/db.text.json");
      expect(new Headers(init?.headers).get("cookie")).toBeNull();
      return new Response(JSON.stringify(database), { headers: { "content-type": "application/json" } });
    });
    const client = new EhClient({
      fetch: fetchMock as typeof fetch,
      cookies: { memberId: "42", passHash: "secret", igneous: "igneous" },
    });

    await expect(client.searchTranslatedTags("3P", 10)).resolves.toEqual(expect.objectContaining({
      matches: [
        expect.objectContaining({ tag: "ffm threesome", translatedName: "女男女3P" }),
        expect.objectContaining({ tag: "mmf threesome", translatedName: "男女男3P" }),
      ],
    }));
    await client.searchTranslatedTags("女男女3P", 10);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects an oversized official release before parsing it", async () => {
    const client = new EhClient({
      fetch: vi.fn(async () => new Response("{}", {
        headers: { "content-length": String(8 * 1024 * 1024 + 1) },
      })) as typeof fetch,
    });

    await expect(client.searchTranslatedTags("3P")).rejects.toThrow("exceeds 8 MiB");
  });

  it("stops reading an oversized release when Content-Length is absent", async () => {
    const client = new EhClient({
      fetch: vi.fn(async () => new Response("x".repeat(8 * 1024 * 1024 + 1))) as typeof fetch,
    });

    await expect(client.searchTranslatedTags("3P")).rejects.toThrow("exceeds 8 MiB");
  });

  it("reports an incompatible official release instead of returning no matches", async () => {
    const client = new EhClient({
      fetch: vi.fn(async () => new Response("{}")) as typeof fetch,
    });

    await expect(client.searchTranslatedTags("3P")).rejects.toThrow("database schema");
  });
});
