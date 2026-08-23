import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseGalleryDetail, parseTorrents } from "../src/parsers.js";
import type { GalleryRef } from "../src/types.js";

const fixture = (name: string) => readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

describe("extended HTML parsers", () => {
  it("parses gallery details, tag strength, and newer versions", async () => {
    expect(parseGalleryDetail(await fixture("gallery-detail.html"))).toEqual({
      description: null,
      gallery: {
        gid: 123,
        token: "123456789a",
        title: "English & Title",
        titleJpn: "日本語タイトル",
        category: "Manga",
        uploader: "Tester",
        posted: "2026-08-01 12:00",
        parent: { gid: 100, token: "aaaaaaaaaa" },
        visible: "Yes",
        language: "Chinese",
        fileSize: "42.0 MiB",
        pages: 24,
        favoriteCount: 321,
        rating: 4.75,
        ratingCount: 12,
        torrentCount: 2,
      },
      tagGroups: [
        { namespace: "language", tags: [{ name: "chinese", strength: "solid" }] },
        { namespace: "female", tags: [{ name: "glasses", strength: "weak" }, { name: "twintails", strength: "solid" }] },
      ],
      newerVersions: [{ gid: 124, token: "bbbbbbbbbb", title: "Newer & Title", added: "2026-08-02 13:00" }],
    });
  });

  it("uses the requested gallery identity when page scripts change", () => {
    const html = '<html><div id="gn">No script identity</div><div id="gdc">Manga</div><div id="gdd"><table></table></div><div id="taglist"><table></table></div></html>';
    const ref: GalleryRef = { gid: 321, token: "abcdef1234" };
    expect(parseGalleryDetail(html, ref).gallery).toEqual(expect.objectContaining(ref));
  });

  it("extracts the gallery description as sanitized untrusted text", () => {
    const html = `<html><div id="gn">Title</div><div id="gdc">Manga</div>
      <div id="gdd"><table></table></div><div id="taglist"><table></table></div>
      <div id="gld"><p>First line<br>Second <strong>line</strong></p><script>ignore()</script></div></html>`;
    expect(parseGalleryDetail(html, { gid: 321, token: "abcdef1234" }).description).toEqual({
      text: "First line\nSecond line",
      untrusted: true,
    });
  });

  it("parses current and outdated torrent records", async () => {
    expect(parseTorrents(await fixture("torrents.html"))).toEqual([
      { id: 99, name: "Current.zip", url: "https://ehtracker.org/get/123/abcdef.torrent", posted: "2026-08-01 12:00", size: "42.0 MiB", seeds: 7, peers: 2, downloads: 123, uploader: "Tester", outdated: false },
      { id: 88, name: "Old.zip", url: "https://ehtracker.org/get/123/oldhash.torrent", posted: "2025-01-01 00:00", size: "10.0 MiB", seeds: 0, peers: 0, downloads: 50, uploader: "OldUser", outdated: true },
    ]);
  });
});
