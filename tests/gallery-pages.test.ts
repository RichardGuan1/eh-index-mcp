import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseGalleryPages } from "../src/parsers.js";

const fixture = (name: string) => readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

describe("gallery preview parsing", () => {
  it("returns image-page tokens and thumbnail data", async () => {
    expect(parseGalleryPages(await fixture("gallery-pages.html"))).toEqual({
      totalPages: 42,
      pages: [
        {
          page: 1,
          pageToken: "aaaaaaaaaa",
          url: "https://e-hentai.org/s/aaaaaaaaaa/123-1",
          thumbnailUrl: "https://ehgt.org/t/first.jpg",
          thumbnailOffsetX: null,
        },
        {
          page: 2,
          pageToken: "bbbbbbbbbb",
          url: "https://e-hentai.org/s/bbbbbbbbbb/123-2",
          thumbnailUrl: "https://ehgt.org/t/sprite.jpg",
          thumbnailOffsetX: 100,
        },
      ],
    });
  });
});
