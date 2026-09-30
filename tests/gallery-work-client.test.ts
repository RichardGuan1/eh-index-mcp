import { describe, expect, it, vi } from "vitest";
import { EhClient } from "../src/client.js";

const summary = (gid: number) => ({
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

describe("gallery work search workflow", () => {
  it("follows search cursors and deduplicates galleries before metadata lookup", async () => {
    const client = new EhClient({ fetch: vi.fn() as typeof fetch });
    const search = vi.spyOn(client, "search")
      .mockResolvedValueOnce({ galleries: [summary(1), summary(2)], prev: null, next: "cursor-2" })
      .mockResolvedValueOnce({ galleries: [summary(2), summary(3)], prev: "cursor-1", next: "cursor-3" });
    const metadata = vi.spyOn(client, "getGalleryMetadataBatch").mockImplementation(async (refs) => ({
      galleries: refs.map((ref) => ({
        ...ref,
        title: `Work ${ref.gid}`,
        tags: [`group:creator-${ref.gid}`],
      })),
      inputCount: refs.length,
      successCount: refs.length,
      errorCount: 0,
      preservedOrder: true,
    }));

    const result = await client.searchGalleryWorks({ query: "test", maxPages: 2 });

    expect(search).toHaveBeenNthCalledWith(1, { query: "test", site: "e-hentai" });
    expect(search).toHaveBeenNthCalledWith(2, { query: "test", site: "e-hentai", next: "cursor-2" });
    expect(metadata).toHaveBeenCalledWith([
      { gid: 1, token: "0000000001" },
      { gid: 2, token: "0000000002" },
      { gid: 3, token: "0000000003" },
    ], "e-hentai");
    expect(result).toMatchObject({
      pagesScanned: 2,
      searchedGalleryCount: 4,
      galleryCount: 3,
      uniqueWorkCount: 3,
      truncated: true,
      next: "cursor-3",
    });
  });

  it("stops at the last page and reports a complete scan", async () => {
    const client = new EhClient({ fetch: vi.fn() as typeof fetch });
    const search = vi.spyOn(client, "search").mockResolvedValue({ galleries: [summary(1)], prev: null, next: null });
    vi.spyOn(client, "getGalleryMetadataBatch").mockResolvedValue({
      galleries: [{ gid: 1, token: "0000000001", title: "Work 1", tags: ["group:creator"] }],
      inputCount: 1,
      successCount: 1,
      errorCount: 0,
      preservedOrder: true,
    });

    const result = await client.searchGalleryWorks({ query: "test", maxPages: 5 });

    expect(search).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ pagesScanned: 1, truncated: false, next: null });
  });

  it("rejects page budgets outside the supported range before searching", async () => {
    const client = new EhClient({ fetch: vi.fn() as typeof fetch });
    const search = vi.spyOn(client, "search");

    await expect(client.searchGalleryWorks({ query: "test", maxPages: 11 })).rejects.toThrow("1 to 10");
    expect(search).not.toHaveBeenCalled();
  });
});
