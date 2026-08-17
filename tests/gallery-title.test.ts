import { describe, expect, it } from "vitest";
import { extractSimilarGalleryTitle, extractTitleParts } from "../src/gallery-title.js";

describe("EhViewer-compatible similar-gallery title extraction", () => {
  it("removes structural prefix and suffix blocks without knowing their words", () => {
    expect(extractSimilarGalleryTitle("(C105) [Circle] {Edition} Main Story ~Branch Alpha~ (Parody) [English]"))
      .toBe("Main Story");
  });

  it("removes chapter ranges from the end", () => {
    expect(extractSimilarGalleryTitle("[Circle] Main Story ch. 1-23"))
      .toBe("Main Story");
  });

  it("uses the left title when a translated title is appended after a pipe", () => {
    expect(extractSimilarGalleryTitle("[Circle] Romanized Title | Translated Title"))
      .toBe("Romanized Title");
  });

  it("returns null when the title contains only structural wrappers", () => {
    expect(extractSimilarGalleryTitle("(C105) [Circle] {Edition} ~Route~"))
      .toBeNull();
  });

  it("does not interpret ordinary words or embedded numbers", () => {
    expect(extractSimilarGalleryTitle("[Circle] Star Chronicle 2 Named Branch (Parody)"))
      .toBe("Star Chronicle 2 Named Branch");
  });

  it("reports the removed suffix for optional ordering metadata", () => {
    expect(extractTitleParts("[Circle] Main Story ~Branch 3.1 + 3.2~ (Parody)")).toEqual({
      title: "Main Story",
      suffix: "~Branch 3.1 + 3.2~ (Parody)",
    });
  });
});