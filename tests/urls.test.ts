import { describe, expect, it } from "vitest";
import { buildSearchUrl, parseGalleryPreviewUrl, parseGalleryUrl, parsePageUrl } from "../src/urls.js";

describe("URL handling", () => {
  it("parses gallery and image-page URLs", () => {
    expect(parseGalleryUrl("https://e-hentai.org/g/2231376/a7584a5932/")).toEqual({
      gid: 2231376,
      token: "a7584a5932",
    });
    expect(parsePageUrl("https://exhentai.org/s/40bc07a79a/618395-11")).toEqual({
      gid: 618395,
      pageToken: "40bc07a79a",
      page: 11,
    });
    expect(parseGalleryPreviewUrl("https://e-hentai.org/g/2231376/a7584a5932/?p=2")).toEqual({
      ref: { gid: 2231376, token: "a7584a5932" },
      previewPage: 2,
    });
  });

  it("builds advanced search parameters and category exclusion mask", () => {
    const url = new URL(buildSearchUrl({
      site: "e-hentai",
      query: "language:chinese$",
      categories: ["doujinshi", "manga"],
      minRating: 4,
      pageFrom: 20,
      pageTo: 80,
      hasTorrent: true,
      next: "4000000",
    }));
    expect(url.hostname).toBe("e-hentai.org");
    expect(url.searchParams.get("f_search")).toBe("language:chinese$");
    expect(url.searchParams.get("f_cats")).toBe("1017");
    expect(url.searchParams.get("advsearch")).toBe("1");
    expect(url.searchParams.get("f_sto")).toBe("on");
    expect(url.searchParams.get("f_sr")).toBe("on");
    expect(url.searchParams.get("f_srdd")).toBe("4");
    expect(url.searchParams.get("f_sp")).toBe("on");
    expect(url.searchParams.get("f_spf")).toBe("20");
    expect(url.searchParams.get("f_spt")).toBe("80");
    expect(url.searchParams.get("next")).toBe("4000000");
  });
});
