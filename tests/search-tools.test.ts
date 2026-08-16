import { describe, expect, it } from "vitest";
import { buildStructuredSearchQuery, getSearchCapabilities } from "../src/search-tools.js";

describe("structured search helpers", () => {
  it("builds quoted, exact, excluded, and OR search terms", () => {
    const expected = 'female:glasses$ language:chinese$ -other:"ai generated"$ ~parody:"blue archive"$ ~parody:original$ title:"comic aun"';
    expect(buildStructuredSearchQuery({
      includeTags: ["female:glasses", "language:chinese"],
      excludeTags: ["other:ai generated"],
      orTags: ["parody:blue archive", "parody:original"],
      title: "comic aun",
      exactTags: true,
    })).toEqual({
      query: expected,
      length: expected.length,
      warnings: [],
    });
  });

  it("enforces official term and length limits", () => {
    expect(() => buildStructuredSearchQuery({ includeTags: ["a", "b", "c", "d", "e", "f"] })).toThrow("at most 5");
    expect(() => buildStructuredSearchQuery({ excludeTags: Array.from({ length: 11 }, (_, i) => `tag${i}`) })).toThrow("at most 10");
    expect(() => buildStructuredSearchQuery({ title: "x".repeat(201) })).toThrow("200 characters");
  });

  it("returns stable search capabilities", () => {
    const capabilities = getSearchCapabilities();
    expect(capabilities.limits).toEqual({ maxQueryLength: 200, maxInclusions: 5, maxExclusions: 10, minimumIntervalMs: 3000 });
    expect(capabilities.qualifiers).toContain("gid");
    expect(capabilities.categories).toHaveLength(10);
  });
});
