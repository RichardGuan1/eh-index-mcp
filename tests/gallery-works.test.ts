import { describe, expect, it } from "vitest";
import { organizeGalleryWorks } from "../src/gallery-works.js";
import type { GalleryMetadata } from "../src/types.js";

const gallery = (overrides: Partial<GalleryMetadata> & Pick<GalleryMetadata, "gid" | "title">): GalleryMetadata => ({
  token: overrides.gid.toString(16).padStart(10, "0").slice(-10),
  category: "Doujinshi",
  posted: String(1_700_000_000 + overrides.gid),
  filecount: "50",
  rating: "4.50",
  tags: ["parody:kimi no na wa.", "group:syukurin"],
  ...overrides,
});

describe("gallery work organization", () => {
  it("groups language variants without merging separate installments", () => {
    const metadata = [
      gallery({ gid: 101, title: "[Syukurin] Mitsuha ~Chapter 10~ (Kimi no Na wa.) [Digital]", tags: ["parody:kimi no na wa.", "group:syukurin"] }),
      gallery({ gid: 102, title: "[Syukurin] Mitsuha ~Chapter 10~ (Kimi no Na wa.) [Chinese] [Digital]", tags: ["parody:kimi no na wa.", "group:syukurin", "language:chinese", "language:translated"] }),
      gallery({ gid: 103, title: "[Syukurin] Mitsuha ~Chapter 10~ (Kimi no Na wa.) [English] [Digital]", tags: ["parody:kimi no na wa.", "group:syukurin", "language:english", "language:translated"] }),
      gallery({ gid: 104, title: "[Syukurin] Mitsuha ~Chapter 9~ (Kimi no Na wa.) [Digital]" }),
      gallery({ gid: 105, title: "[Kashikomura] Chapter Hime Mitsuha (Kimi no Na wa.)", tags: ["parody:kimi no na wa.", "group:kashikomura"] }),
    ];

    const result = organizeGalleryWorks(metadata, "e-hentai");

    expect(result).toMatchObject({ galleryCount: 5, uniqueWorkCount: 3, seriesCount: 2 });
    const syukurin = result.series.find((series) => series.creators.includes("group:syukurin"));
    expect(syukurin?.works).toHaveLength(2);
    expect(syukurin?.works.map((work) => work.installment)).toEqual(["9", "10"]);
    expect(syukurin?.works.find((work) => work.installment === "10")?.variants).toHaveLength(3);
    expect(syukurin?.works.find((work) => work.installment === "10")?.availableLanguages).toEqual(["chinese", "english"]);
    expect(syukurin?.works.find((work) => work.installment === "10")?.groupingBasis).toBe("normalized-title-and-creator");
    expect(syukurin?.works.find((work) => work.installment === "10")?.groupingExplanation)
      .toContain("normalized title and shared creator");

    const kashikomura = result.series.find((series) => series.creators.includes("group:kashikomura"));
    expect(kashikomura?.works).toHaveLength(1);
  });

  it("ignores translator credit suffixes on translated variants", () => {
    const metadata = [
      gallery({ gid: 151, title: "[Syukurin] Mitsuha ~Chapter 10~ (Kimi no Na wa.) [Digital]" }),
      gallery({
        gid: 152,
        title: "[Syukurin] Mitsuha ~Chapter 10~ (Kimi no Na wa.) [Chinese] [Example Team] [Digital]",
        tags: ["parody:kimi no na wa.", "group:syukurin", "language:chinese", "language:translated"],
      }),
    ];

    const result = organizeGalleryWorks(metadata, "e-hentai");

    expect(result.uniqueWorkCount).toBe(1);
    expect(result.series[0]?.works[0]?.availableLanguages).toEqual(["chinese"]);
  });

  it("groups numbered installments when a different parody suffix follows the volume", () => {
    const metadata = [
      gallery({ gid: 171, title: "[Other Circle] Hero ~Chapter 1~ (Another Work)", tags: ["parody:another work", "group:other circle"] }),
      gallery({ gid: 172, title: "[Other Circle] Hero ~Chapter 2~ (Another Work)", tags: ["parody:another work", "group:other circle"] }),
    ];

    const result = organizeGalleryWorks(metadata, "e-hentai");

    expect(result).toMatchObject({ uniqueWorkCount: 2, seriesCount: 1 });
    expect(result.series[0]?.works.map((work) => work.installment)).toEqual(["1", "2"]);
  });

  it("groups arbitrary structural suffixes without interpreting their words", () => {
    const metadata = [
      gallery({ gid: 173, title: "[Other Circle] Main Story ~Branch Alpha~ (Another Work)", tags: ["parody:another work", "group:other circle"] }),
      gallery({ gid: 174, title: "[Other Circle] Main Story ~Branch Beta~ (Another Work)", tags: ["parody:another work", "group:other circle"] }),
    ];

    const result = organizeGalleryWorks(metadata, "e-hentai");

    expect(result).toMatchObject({ uniqueWorkCount: 2, seriesCount: 1 });
    expect(result.series[0]?.title).toBe("Main Story");
  });

  it("keeps identical extracted titles separate across unrelated creators", () => {
    const metadata = [
      gallery({ gid: 175, title: "[Circle One] Main Story ~Branch Alpha~ (Another Work)", tags: ["parody:another work", "group:circle one"] }),
      gallery({ gid: 176, title: "[Circle Two] Main Story ~Branch Beta~ (Another Work)", tags: ["parody:another work", "group:circle two"] }),
    ];

    const result = organizeGalleryWorks(metadata, "e-hentai");

    expect(result).toMatchObject({ uniqueWorkCount: 2, seriesCount: 2 });
  });

  it("ignores event prefixes when grouping installments into a series", () => {
    const metadata = [
      gallery({ gid: 181, title: "(C94) [Syukurin] Mitsuha ~Chapter 5~ (Kimi no Na wa.)", tags: ["parody:kimi no na wa.", "artist:syukurin", "group:syukurin"] }),
      gallery({ gid: 182, title: "(C97) [Syukurin] Mitsuha ~Chapter 7~ (Kimi no Na wa.)", tags: ["parody:kimi no na wa.", "artist:syukurin", "group:syukurin"] }),
    ];

    const result = organizeGalleryWorks(metadata, "e-hentai");

    expect(result).toMatchObject({ uniqueWorkCount: 2, seriesCount: 1 });
    expect(result.series[0]?.works.map((work) => work.installment)).toEqual(["5", "7"]);
  });

  it("treats artist-only and matching artist-group tags as the same creator", () => {
    const metadata = [
      gallery({ gid: 191, title: "[Syukurin] Mitsuha ~Chapter 9~ (Kimi no Na wa.)", tags: ["parody:kimi no na wa.", "artist:syukurin", "group:syukurin"] }),
      gallery({ gid: 192, title: "[Syukurin] Mitsuha ~Chapter 9~ (Kimi no Na wa.) [Chinese]", tags: ["parody:kimi no na wa.", "artist:syukurin", "language:chinese", "language:translated"] }),
    ];

    const result = organizeGalleryWorks(metadata, "e-hentai");

    expect(result).toMatchObject({ uniqueWorkCount: 1, seriesCount: 1 });
    expect(result.series[0]?.works[0]).toMatchObject({
      creators: ["artist:syukurin", "group:syukurin"],
      variants: expect.any(Array),
    });
    expect(result.series[0]?.works[0]?.variants).toHaveLength(2);
  });

  it("groups separate installments when their creator tag sets overlap", () => {
    const metadata = [
      gallery({ gid: 193, title: "[Syukurin] Mitsuha ~Chapter 9~ (Kimi no Na wa.)", tags: ["parody:kimi no na wa.", "artist:syukurin"] }),
      gallery({ gid: 194, title: "[Syukurin] Mitsuha ~Chapter 10~ (Kimi no Na wa.)", tags: ["parody:kimi no na wa.", "artist:syukurin", "group:syukurin"] }),
    ];

    const result = organizeGalleryWorks(metadata, "e-hentai");

    expect(result).toMatchObject({ uniqueWorkCount: 2, seriesCount: 1 });
    expect(result.series[0]?.creators).toEqual(["artist:syukurin", "group:syukurin"]);
    expect(result.series[0]?.works.map((work) => work.installment)).toEqual(["9", "10"]);
  });

  it("ignores a translated title appended after a pipe", () => {
    const metadata = [
      gallery({ gid: 195, title: "[Syukurin] Mitsuha ~Chapter~ Soushuuhen III", tags: ["parody:kimi no na wa.", "artist:syukurin", "group:syukurin"] }),
      gallery({ gid: 196, title: "[Syukurin] Mitsuha ~Chapter~ Soushuuhen III | 미츠하 챕터 총집편", tags: ["parody:kimi no na wa.", "artist:syukurin", "group:syukurin", "language:korean", "language:translated"] }),
    ];

    const result = organizeGalleryWorks(metadata, "e-hentai");

    expect(result).toMatchObject({ uniqueWorkCount: 1, seriesCount: 1 });
    expect(result.series[0]?.works[0]?.availableLanguages).toEqual(["korean"]);
    expect(result.series[0]?.works[0]?.variants).toHaveLength(2);
  });

  it("merges the same installment across event and letter-digit spacing variants", () => {
    const metadata = [
      gallery({ gid: 197, title: "(COMIC1☆13) [Syukurin] Mitsuha ~Chapter 4~ (Kimi no Na wa.)", tags: ["parody:kimi no na wa.", "artist:syukurin", "group:syukurin"] }),
      gallery({ gid: 198, title: "(COMIC1☆13) [Syukurin] Mitsuha ~Chapter4~ (Kimi no Na wa.) [English]", tags: ["parody:kimi no na wa.", "artist:syukurin", "group:syukurin", "language:english", "language:translated"] }),
    ];

    const result = organizeGalleryWorks(metadata, "e-hentai");

    expect(result).toMatchObject({ uniqueWorkCount: 1, seriesCount: 1 });
    expect(result.series[0]?.works[0]?.installment).toBe("4");
    expect(result.series[0]?.works[0]?.variants).toHaveLength(2);
  });

  it("ignores a trailing parody qualifier when metadata confirms the same parody", () => {
    const metadata = [
      gallery({ gid: 199, title: "(C102) [Syukurin] Mitsuha ~Chapter~ Soushuuhen III (Kimi no Na wa.)", tags: ["parody:kimi no na wa.", "artist:syukurin", "group:syukurin"] }),
      gallery({ gid: 200, title: "(C102) [Syukurin] Mitsuha ~Chapter~ Soushuuhen III | 미츠하 챕터 총집편 3 [Korean]", tags: ["parody:kimi no na wa.", "artist:syukurin", "group:syukurin", "language:korean", "language:translated"] }),
    ];

    const result = organizeGalleryWorks(metadata, "e-hentai");

    expect(result).toMatchObject({ uniqueWorkCount: 1, seriesCount: 1 });
    expect(result.series[0]?.works[0]?.variants).toHaveLength(2);
  });

  it("prefers official current-version links over title similarity", () => {
    const metadata = [
      gallery({
        gid: 201,
        title: "[Syukurin] Mitsuha ~Chapter 8~ sample (Kimi no Na wa.)",
        current_gid: "202",
        current_key: "00000000ca",
        tags: ["parody:kimi no na wa.", "artist:syukurin", "group:syukurin"],
      }),
      gallery({
        gid: 202,
        token: "00000000ca",
        title: "[Syukurin] Mitsuha ~Chapter 8~ (Kimi no Na wa.) [Digital]",
        tags: ["parody:kimi no na wa.", "artist:syukurin"],
      }),
    ];

    const result = organizeGalleryWorks(metadata, "e-hentai");

    expect(result.uniqueWorkCount).toBe(1);
    expect(result.series[0]?.works[0]?.variants).toHaveLength(2);
    expect(result.series[0]?.works[0]?.creators).toEqual(["artist:syukurin", "group:syukurin"]);
    expect(result.series[0]?.works[0]?.preferredGallery.gid).toBe(202);
    expect(result.series[0]?.works[0]?.groupingBasis).toBe("official-version-chain");
    expect(result.series[0]?.works[0]?.groupingExplanation).toContain("official current-version links");
  });

  it("reports standalone when no official chain or creator-backed match exists", () => {
    const result = organizeGalleryWorks([
      gallery({ gid: 203, title: "Unrelated upload", tags: [] }),
    ], "e-hentai");

    expect(result.series[0]?.works[0]).toMatchObject({
      groupingBasis: "standalone",
      groupingExplanation: "Kept as a standalone work because no official version chain or creator-backed title match was found.",
    });
  });
});
