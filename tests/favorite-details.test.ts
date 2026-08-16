import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { EhClient } from "../src/client.js";
import { parseFavoriteCategories, parseFavoriteDetail } from "../src/parsers.js";
import { SerialRateLimiter } from "../src/rate-limiter.js";

const fixture = () => readFile(new URL("./fixtures/favorites.html", import.meta.url), "utf8");

describe("favorite metadata", () => {
  it("parses all ten named categories, counts, and the selected category", async () => {
    await expect(fixture().then(parseFavoriteCategories)).resolves.toEqual({
      total: 123,
      selected: 0,
      categories: expect.arrayContaining([
        { index: 0, name: "Research", count: 12 },
        { index: 2, name: "Art", count: 34 },
      ]),
    });
  });

  it("parses the current div-based favorite category navigation", () => {
    const render = (selected: number | "all") => `<div class="ido">${Array.from({ length: 10 }, (_, index) => `
      <div class="nosel">
        <div class="fp${selected === index ? " fps" : ""}" onclick="document.location='https://e-hentai.org/favorites.php?favcat=${index}'">
          <div>${index === 0 ? "2" : "0"}</div>
          <div class="i"></div>
          <div>Favorites ${index}</div>
        </div>
      </div>`).join("")}</div>`;

    const categories = Array.from({ length: 10 }, (_, index) => ({
      index,
      name: `Favorites ${index}`,
      count: index === 0 ? 2 : 0,
    }));
    expect(parseFavoriteCategories(render("all"))).toEqual({ total: 2, selected: "all", categories });
    expect(parseFavoriteCategories(render(0))).toEqual({ total: 2, selected: 0, categories });
    expect(() => parseFavoriteCategories(`${render("all")}<div class="fp fps" onclick="document.location='?favcat=all'"></div>`))
      .toThrow("Expected 10 favorite categories");
  });

  it("rejects a category menu without a selected category marker", async () => {
    const html = (await fixture()).replace(
      '<div><a href="/favorites.php?favcat=0">',
      '<div class="nosel"><a href="/favorites.php?favcat=0">',
    );

    expect(() => parseFavoriteCategories(html)).toThrow("selected favorite category");
  });

  it("rejects a category menu without the all-favorites total", async () => {
    const html = (await fixture()).replace(
      '<div class="nosel"><a href="/favorites.php?favcat=all">Show All Favorites</a> <span>123</span></div>',
      "",
    );

    expect(() => parseFavoriteCategories(html)).toThrow("all-favorites total");
  });

  it("requires credentials before requesting favorite categories", async () => {
    const fetchMock = vi.fn();
    const client = new EhClient({ fetch: fetchMock as typeof fetch, pageLimiter: new SerialRateLimiter(0) });
    await expect(client.getFavoriteCategories()).rejects.toThrow("EH_MEMBER_ID");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shares the favorites search rate-limit budget when loading categories", async () => {
    const html = await fixture();
    const searchLimiter = { run: vi.fn(async (operation: () => Promise<unknown>) => operation()) };
    const pageLimiter = { run: vi.fn(async (operation: () => Promise<unknown>) => operation()) };
    const client = new EhClient({
      fetch: vi.fn(async () => new Response(html)) as typeof fetch,
      cookies: { memberId: "42", passHash: "secret" },
      searchLimiter: searchLimiter as unknown as SerialRateLimiter,
      pageLimiter: pageLimiter as unknown as SerialRateLimiter,
    });

    await client.getFavoriteCategories();

    expect(searchLimiter.run).toHaveBeenCalledOnce();
    expect(pageLimiter.run).not.toHaveBeenCalled();
  });

  it("parses one gallery favorite slot, note, and favorited time", async () => {
    const [popup, list] = await Promise.all([
      readFile(new URL("./fixtures/favorite-popup.html", import.meta.url), "utf8"),
      readFile(new URL("./fixtures/favorite-list-detail.html", import.meta.url), "utf8"),
    ]);
    expect(parseFavoriteDetail(popup, list, { gid: 123, token: "123456789a" })).toEqual({
      gallery: { gid: 123, token: "123456789a" },
      favorited: true,
      category: { index: 2, name: "Art" },
      note: "Excellent & complete",
      favoritedAt: "2026-08-15 08:30",
    });
  });

  it("recognizes a current popup's explicit remove action as existing favorite state", () => {
    const popup = `<form>
      <div>
        <div><input type="radio" name="favcat" value="0" id="fav0" checked></div>
        <div class="i"></div>
        <div>Research</div>
        <div class="c"></div>
      </div>
      <textarea name="favnote">Current note</textarea>
      <div onclick="return favdel()">Remove from Favorites</div>
    </form>`;
    const emptyFavorites = "<html><body><p>No hits found</p></body></html>";

    expect(parseFavoriteDetail(popup, emptyFavorites, { gid: 123, token: "123456789a" })).toEqual({
      gallery: { gid: 123, token: "123456789a" },
      favorited: true,
      category: { index: 0, name: "Research" },
      note: "Current note",
      favoritedAt: null,
    });
  });

  it("does not treat a popup default category as an existing favorite", () => {
    const popup = `<form>
      <input type="radio" name="favcat" value="0" id="fav0" checked>
      <label for="fav0">Research</label>
      <textarea name="favnote"></textarea>
    </form>`;
    const emptyFavorites = "<html><body><p>No hits found</p></body></html>";

    expect(parseFavoriteDetail(popup, emptyFavorites, { gid: 123, token: "123456789a" })).toEqual({
      gallery: { gid: 123, token: "123456789a" },
      favorited: false,
      category: null,
      note: null,
      favoritedAt: null,
    });
  });

  it("does not attribute an unrelated favorites search row to the requested gallery", () => {
    const popup = `<form>
      <input type="radio" name="favcat" value="2" id="fav2" checked>
      <label for="fav2">Art</label>
      <textarea name="favnote">Unrelated note</textarea>
    </form>`;
    const unrelatedFavorites = `<table><tr>
      <td class="glname"><a class="glink" href="https://e-hentai.org/g/999/9999999999/">Other gallery</a></td>
      <td><div class="glfav">2026-08-15 08:30</div></td>
    </tr></table>`;

    expect(parseFavoriteDetail(popup, unrelatedFavorites, { gid: 123, token: "123456789a" }))
      .toEqual({
        gallery: { gid: 123, token: "123456789a" },
        favorited: false,
        category: null,
        note: null,
        favoritedAt: null,
      });
  });

  it("matches a favorite row when the requested token uses uppercase hex", async () => {
    const [popup, list] = await Promise.all([
      readFile(new URL("./fixtures/favorite-popup.html", import.meta.url), "utf8"),
      readFile(new URL("./fixtures/favorite-list-detail.html", import.meta.url), "utf8"),
    ]);

    expect(parseFavoriteDetail(popup, list, { gid: 123, token: "123456789A" }).favorited)
      .toBe(true);
  });

  it("requires credentials before requesting favorite detail", async () => {
    const fetchMock = vi.fn();
    const client = new EhClient({ fetch: fetchMock as typeof fetch, pageLimiter: new SerialRateLimiter(0) });
    await expect(client.getFavoriteDetail({ gid: 123, token: "123456789a" })).rejects.toThrow("EH_MEMBER_ID");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});