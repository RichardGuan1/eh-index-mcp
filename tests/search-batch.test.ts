import { describe, expect, it, vi } from "vitest";
import { EhClient } from "../src/client.js";
import type { GallerySummary, SearchOptions } from "../src/types.js";

const summary = (gid: number): GallerySummary => ({
  gid,
  token: gid.toString(16).padStart(10, "0"),
  url: `https://e-hentai.org/g/${gid}/${gid.toString(16).padStart(10, "0")}/`,
  title: `Gallery ${gid}`,
  category: "Doujinshi",
  uploader: null,
  posted: null,
  pages: 10,
  rating: 4,
  tags: [],
  thumbnailUrl: null,
});

type BatchSearchOptions = SearchOptions & { maxPages?: number };
type BatchSearchResult = {
  galleries: GallerySummary[];
  inputCount: number;
  pagesScanned: number;
  resultCount: number;
  errorCount: 0;
  preservedOrder: true;
  truncated: boolean;
  next: string | null;
};

describe("multi-page gallery search", () => {
  it("follows cursors, deduplicates galleries, and returns a resume cursor", async () => {
    const client = new EhClient({ fetch: vi.fn() as typeof fetch });
    const search = vi.spyOn(client, "search")
      .mockResolvedValueOnce({ galleries: [summary(1), summary(2)], prev: null, next: "cursor-2" })
      .mockResolvedValueOnce({ galleries: [summary(2), summary(3)], prev: "cursor-1", next: "cursor-3" });
    const searchBatch = (client as unknown as {
      searchBatch(options: BatchSearchOptions): Promise<BatchSearchResult>;
    }).searchBatch.bind(client);

    const result = await searchBatch({ site: "exhentai", query: "test", maxPages: 2 });

    expect(search).toHaveBeenNthCalledWith(1, { site: "exhentai", query: "test" });
    expect(search).toHaveBeenNthCalledWith(2, { site: "exhentai", query: "test", next: "cursor-2" });
    expect(result).toEqual({
      galleries: [summary(1), summary(2), summary(3)],
      inputCount: 3,
      pagesScanned: 2,
      resultCount: 3,
      errorCount: 0,
      preservedOrder: true,
      truncated: true,
      next: "cursor-3",
    });
  });
});
