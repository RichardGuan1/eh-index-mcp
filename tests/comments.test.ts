import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { EhClient } from "../src/client.js";
import { parseGalleryComments } from "../src/parsers.js";
import { SerialRateLimiter } from "../src/rate-limiter.js";

const fixture = () => readFile(new URL("./fixtures/comments.html", import.meta.url), "utf8");

describe("gallery comments", () => {
  it("parses uploader and regular comments as untrusted text", async () => {
    expect(parseGalleryComments(await fixture())).toEqual([
      {
        id: 0,
        author: "Owner",
        posted: "01 January 2026, 12:30",
        score: null,
        uploaderComment: true,
        text: "Line one\nLine two link",
        votes: null,
        untrusted: true,
      },
      {
        id: 456,
        author: "Reader",
        posted: "02 January 2026, 13:45",
        score: -3,
        uploaderComment: false,
        text: "Useful review",
        votes: "Base -1, Someone -2",
        untrusted: true,
      },
    ]);
  });

  it("requests hidden comments with hc=1", async () => {
    const html = await fixture();
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      expect(new URL(String(url)).searchParams.get("hc")).toBe("1");
      return new Response(html);
    });
    const client = new EhClient({ fetch: fetchMock as typeof fetch, pageLimiter: new SerialRateLimiter(0) });
    const result = await client.getGalleryComments({ gid: 123, token: "123456789a" }, "e-hentai", true);
    expect(result.comments).toHaveLength(2);
    expect(result.includeHidden).toBe(true);
  });
});
