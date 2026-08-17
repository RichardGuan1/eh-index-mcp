import { describe, expect, it, vi } from "vitest";
import { EhClient } from "../src/client.js";

const ref = { gid: 123, token: "123456789a" };
const emptyResult = { galleries: [], prev: null, next: null };

describe("EhViewer-compatible similar gallery search", () => {
  it("extracts a structural title and searches it as a quoted phrase", async () => {
    const client = new EhClient({ fetch: vi.fn() as typeof fetch });
    vi.spyOn(client, "getGalleryMetadata").mockResolvedValue([{
      ...ref,
      title: "(C105) [Circle] Main Story ~Branch Alpha~ (Parody)",
      tags: ["artist:example"],
      uploader: "uploader-name",
    }]);
    const search = vi.spyOn(client, "search").mockResolvedValue(emptyResult);

    const result = await client.findSimilarGalleries(ref);

    expect(result).toEqual({ strategy: "title", query: '"Main Story"', result: emptyResult });
    expect(search).toHaveBeenCalledWith({ site: "e-hentai", query: '"Main Story"' });
  });

  it("falls back to the first artist when no structural title remains", async () => {
    const client = new EhClient({ fetch: vi.fn() as typeof fetch });
    vi.spyOn(client, "getGalleryMetadata").mockResolvedValue([{
      ...ref,
      title: "(C105) [Circle] ~Branch Alpha~",
      tags: ["group:circle", "artist:example artist"],
      uploader: "uploader-name",
    }]);
    const search = vi.spyOn(client, "search").mockResolvedValue(emptyResult);

    const result = await client.findSimilarGalleries(ref, "exhentai");

    expect(result).toEqual({ strategy: "artist", query: 'artist:"example artist"$', result: emptyResult });
    expect(search).toHaveBeenCalledWith({ site: "exhentai", query: 'artist:"example artist"$' });
  });

  it("falls back to uploader when title and artist are unavailable", async () => {
    const client = new EhClient({ fetch: vi.fn() as typeof fetch });
    vi.spyOn(client, "getGalleryMetadata").mockResolvedValue([{
      ...ref,
      title: "[Circle]",
      tags: ["group:circle"],
      uploader: "uploader-name",
    }]);
    const search = vi.spyOn(client, "search").mockResolvedValue(emptyResult);

    const result = await client.findSimilarGalleries(ref);

    expect(result).toEqual({ strategy: "uploader", query: 'uploader:"uploader-name"', result: emptyResult });
  });
});