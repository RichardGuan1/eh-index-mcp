import { describe, expect, it } from "vitest";
import { parseTagTranslationDatabase, searchTranslatedTags } from "../src/tag-translations.js";

const fixture = {
  repo: "https://github.com/EhTagTranslation/Database",
  head: { sha: "0123456789abcdef0123456789abcdef01234567" },
  version: 7,
  data: [
    {
      namespace: "mixed",
      data: {
        "ffm threesome": { name: "女男女3P", intro: "2 女 1 男。", links: "" },
        "mmf threesome": { name: "男女男3P", intro: "2 男 1 女。", links: "" },
        "st 3point": { name: "立体视点", intro: "原始标签包含 3p，但中文名不包含。", links: "" },
        group: { name: "乱交", intro: "包含多种 3P 标签。", links: "" },
      },
    },
    {
      namespace: "female",
      data: {
        catgirl: { name: "猫女", intro: "猫耳角色。", links: "" },
      },
    },
  ],
};

describe("EhTagTranslation database", () => {
  it("returns every translated tag whose formal Chinese name contains 3P", () => {
    const database = parseTagTranslationDatabase(fixture);

    expect(searchTranslatedTags(database, "3P", 10)).toEqual({
      source: {
        repository: "https://github.com/EhTagTranslation/Database",
        revision: "0123456789abcdef0123456789abcdef01234567",
        version: 7,
        license: "CC BY-NC-SA 3.0 CN",
      },
      untrusted: true,
      matches: [
        {
          namespace: "mixed",
          tag: "ffm threesome",
          translatedName: "女男女3P",
          intro: "2 女 1 男。",
          searchQuery: 'mixed:"ffm threesome"$',
          match: "name-contains",
        },
        {
          namespace: "mixed",
          tag: "mmf threesome",
          translatedName: "男女男3P",
          intro: "2 男 1 女。",
          searchQuery: 'mixed:"mmf threesome"$',
          match: "name-contains",
        },
      ],
    });
  });

  it("ranks an exact translated name above partial matches", () => {
    const result = searchTranslatedTags(parseTagTranslationDatabase(fixture), "女男女3P", 10);

    expect(result.matches).toEqual([
      expect.objectContaining({
        namespace: "mixed",
        tag: "ffm threesome",
        translatedName: "女男女3P",
        match: "name-exact",
      }),
    ]);
  });

  it("ignores title punctuation and spacing in translated-name lookup", () => {
    const database = parseTagTranslationDatabase({
      ...fixture,
      data: [
        ...fixture.data,
        {
          namespace: "parody",
          data: {
            "senren banka": { name: "千恋＊万花", intro: "作品标签。", links: "" },
          },
        },
      ],
    });

    expect(searchTranslatedTags(database, "千恋万花", 10).matches).toEqual([
      expect.objectContaining({
        namespace: "parody",
        tag: "senren banka",
        translatedName: "千恋＊万花",
        match: "name-exact",
      }),
    ]);
    expect(searchTranslatedTags(database, "senren banka", 10).matches[0]).toEqual(
      expect.objectContaining({ tag: "senren banka", match: "tag-exact" }),
    );
  });

  it("rejects a query that becomes empty after punctuation normalization", () => {
    const database = parseTagTranslationDatabase(fixture);

    expect(() => searchTranslatedTags(database, "＊＊＊", 10))
      .toThrow("must contain letters or numbers");
  });

  it("rejects an incompatible upstream schema", () => {
    expect(() => parseTagTranslationDatabase({ repo: "https://example.test", data: [] }))
      .toThrow("EhTagTranslation database schema");
  });
});
