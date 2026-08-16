import { describe, expect, it } from "vitest";
import { buildFavoritesUrl } from "../src/urls.js";

describe("favorite URL handling", () => {
  it("builds a category-filtered favorites search with cursors", () => {
    const url = new URL(buildFavoritesUrl({
      site: "exhentai",
      category: 3,
      query: "favnote:excellent",
      next: "4000000",
    }));
    expect(url.hostname).toBe("exhentai.org");
    expect(url.pathname).toBe("/favorites.php");
    expect(url.searchParams.get("favcat")).toBe("3");
    expect(url.searchParams.get("f_search")).toBe("favnote:excellent");
    expect(url.searchParams.get("next")).toBe("4000000");
  });
});
