import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseGalleryList, parseImagePage } from "../src/parsers.js";

const fixture = (name: string) => readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

describe("HTML parsers", () => {
  it("rejects Cloudflare challenge pages instead of returning empty results", () => {
    const challenge = '<html><title>Just a moment...</title><div class="cf-chl-widget"></div></html>';
    expect(() => parseGalleryList(challenge)).toThrow("Cloudflare challenge");
  });

  it("rejects a login page instead of returning empty results", () => {
    const login = '<html><title>E-Hentai.org Login</title><form name="ipb_login_form"></form></html>';
    expect(() => parseGalleryList(login)).toThrow("login page");
  });

  it("rejects an IP-ban page and preserves the reported remaining time", () => {
    const banned = "Your IP address has been temporarily banned for excessive pageloads which indicates that you are using automated mirroring/harvesting software. The ban expires in 59 minutes and 48 seconds";
    expect(() => parseGalleryList(banned)).toThrow("IP temporarily banned for 59 minutes and 48 seconds");
  });

  it("returns an empty list for a normal no-hits page", () => {
    expect(parseGalleryList('<html><p>No hits found</p></html>')).toEqual({
      galleries: [],
      prev: null,
      next: null,
    });
  });

  it("decodes the fallback rating sprite", () => {
    const html = `<table class="itg"><tr>
      <td class="gl1c"><div class="cn">Manga</div></td>
      <td class="gl2c"><div class="glthumb"><img src="https://ehgt.org/t.jpg"></div></td>
      <td class="gl3c glname"><a href="https://e-hentai.org/g/123/123456789a/"><div class="glink">Sprite rating</div></a></td>
      <td class="gl4c"><div class="ir" style="background-position:0px -21px"></div></td>
    </tr></table>`;
    expect(parseGalleryList(html).galleries[0]?.rating).toBe(4.5);
  });

  it("parses a gallery-list result and cursors", async () => {
    const result = parseGalleryList(await fixture("search.html"));
    expect(result.prev).toBe("4123000");
    expect(result.next).toBe("4121000");
    expect(result.galleries).toEqual([
      expect.objectContaining({
        gid: 4122220,
        token: "123456789a",
        title: "Sample & Title",
        category: "Doujinshi",
        uploader: "TestUser",
        posted: "2026-08-14 15:00",
        pages: 42,
        rating: 4.5,
        tags: ["language:chinese", "artist:tester"],
        thumbnailUrl: "https://ehgt.org/ab/cd/thumb-250.jpg",
      }),
    ]);
  });

  it("resolves relative gallery links against the requested ExHentai site", () => {
    const html = `<table class="itg"><tr>
      <td class="gl1c"><div class="cn">Manga</div></td>
      <td class="gl3c glname"><a href="/g/123/123456789a/"><div class="glink">ExHentai result</div></a></td>
    </tr></table>`;

    expect(parseGalleryList(html, "exhentai").galleries[0]?.url)
      .toBe("https://exhentai.org/g/123/123456789a/");
  });

  it("rejects a 509 placeholder image returned with HTTP 200", () => {
    const html = '<div id="i3"><img id="img" src="https://ehgt.org/g/509.gif"></div>';
    expect(() => parseImagePage(html)).toThrow("image quota exhausted");
  });

  it("rejects a textual image-limit response returned with HTTP 200", () => {
    expect(() => parseImagePage("You have exceeded your image viewing limits"))
      .toThrow("image quota exhausted");
  });

  it("rejects an insufficient-GP image-limit response returned with HTTP 200", () => {
    expect(() => parseImagePage("You have reached the image limit, and do not have sufficient GP to buy a download quota."))
      .toThrow("image quota exhausted");
  });

  it("parses current image, original image, show key, and next page", async () => {
    expect(parseImagePage(await fixture("image-page.html"))).toEqual({
      imageUrl: "https://example.org/image.jpg",
      originalImageUrl: "https://e-hentai.org/fullimg/123/1/key/image.jpg",
      showKey: "abc123def456",
      skipHathKey: "skip-hath-key",
      nextPageUrl: "https://e-hentai.org/s/nexttoken00/123-2",
      previousPageUrl: "https://e-hentai.org/s/prevtoken00/123-1",
    });
  });

  it("resolves relative image navigation against ExHentai", async () => {
    const html = (await fixture("image-page.html")).replaceAll("https://e-hentai.org/", "/");
    const result = parseImagePage(html, "exhentai");

    expect(result.originalImageUrl).toBe("https://exhentai.org/fullimg/123/1/key/image.jpg");
    expect(result.nextPageUrl).toBe("https://exhentai.org/s/nexttoken00/123-2");
    expect(result.previousPageUrl).toBe("https://exhentai.org/s/prevtoken00/123-1");
  });
});
