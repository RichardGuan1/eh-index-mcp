import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "../src/server.js";

const closeables: Array<{ close(): Promise<void> }> = [];
afterEach(async () => {
  await Promise.all(closeables.splice(0).map((item) => item.close()));
});

describe("MCP server", () => {
  it("advertises the read-only tool surface and calls gallery metadata", async () => {
    const backend = {
      getGalleryMetadata: vi.fn(async () => [{ gid: 123, token: "123456789a", title: "Test gallery" }]),
    };
    const server = createServer(backend as never);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    closeables.push(client, server);

    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
      "eh_build_search_query",
      "eh_check_access",
      "eh_compare_gallery_versions",
      "eh_find_latest_gallery_version",
      "eh_get_all_gallery_pages",
      "eh_get_archive_options",
      "eh_get_favorite_categories",
      "eh_get_favorite_detail",
      "eh_get_gallery_chain",
      "eh_get_gallery_comments",
      "eh_get_gallery_detail",
      "eh_get_gallery_metadata",
      "eh_get_gallery_metadata_batch",
      "eh_get_gallery_pages",
      "eh_get_image_page",
      "eh_get_popular",
      "eh_get_search_capabilities",
      "eh_get_torrents",
      "eh_lookup_tag_definition",
      "eh_resolve_gallery",
      "eh_resolve_gallery_batch",
      "eh_search_by_file",
      "eh_search_by_hash",
      "eh_search_favorites",
      "eh_search_galleries",
    ]);
    expect(tools.tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
    expect(tools.tools.every((tool) => tool.outputSchema !== undefined)).toBe(true);

    const result = await client.callTool({
      name: "eh_get_gallery_metadata",
      arguments: { galleries: [{ gid: 123, token: "123456789a" }] },
    });
    expect(result.structuredContent).toEqual({
      galleries: [{ gid: 123, token: "123456789a", title: "Test gallery" }],
    });
  });

  it("returns check-access backend failures as MCP tool errors", async () => {
    const backend = {
      checkAccess: vi.fn(async () => { throw new Error("diagnostic failed"); }),
    };
    const server = createServer(backend as never);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    closeables.push(client, server);

    const result = await client.callTool({ name: "eh_check_access", arguments: { site: "e-hentai" } });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "diagnostic failed" }]);
  });

  it("routes the extended read-only tools and returns structured content", async () => {
    const page = { gid: 123, pageToken: "abcdef1234", page: 1 };
    const gallery = { gid: 123, token: "123456789a" };
    const backend = {
      resolveGalleryTokensBatch: vi.fn(async () => [{ ...page, token: gallery.token }]),
      getFavoriteCategories: vi.fn(async () => ({
        total: 1,
        selected: "all" as const,
        categories: [{ index: 0, name: "Favorites 0", count: 1 }],
      })),
      getFavoriteDetail: vi.fn(async () => ({
        gallery,
        favorited: true,
        category: { index: 0, name: "Favorites 0" },
        note: "Saved",
        favoritedAt: "2026-08-16 12:00",
      })),
      getArchiveOptions: vi.fn(async () => ({
        balance: "1,000 GP",
        options: [{ kind: "original" as const, resolution: "original", size: "10 MiB", cost: "100 GP" }],
      })),
      lookupTagDefinition: vi.fn(async () => ({
        title: "AI Generated",
        description: "Definition",
        tagType: "Technical",
        slaveTags: [],
        notes: null,
        sourceUrl: "https://ehwiki.org/wiki/ai_generated",
        untrusted: true as const,
      })),
    };
    const server = createServer(backend as never);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    closeables.push(client, server);

    const batch = await client.callTool({ name: "eh_resolve_gallery_batch", arguments: { pages: [page] } });
    expect(batch.structuredContent).toEqual({ results: [{ ...page, token: gallery.token }] });

    const categories = await client.callTool({ name: "eh_get_favorite_categories", arguments: {} });
    expect(categories.structuredContent).toEqual({ result: await backend.getFavoriteCategories.mock.results[0]!.value });

    const favorite = await client.callTool({
      name: "eh_get_favorite_detail",
      arguments: { galleryUrl: "https://exhentai.org/g/123/123456789a/" },
    });
    expect(favorite.structuredContent).toEqual({ result: await backend.getFavoriteDetail.mock.results[0]!.value });
    expect(backend.getFavoriteDetail).toHaveBeenCalledWith(gallery, "exhentai");

    const archive = await client.callTool({ name: "eh_get_archive_options", arguments: { gallery } });
    expect(archive.structuredContent).toEqual({ result: await backend.getArchiveOptions.mock.results[0]!.value });

    const definition = await client.callTool({ name: "eh_lookup_tag_definition", arguments: { tag: "ai generated" } });
    expect(definition.structuredContent).toEqual({ result: await backend.lookupTagDefinition.mock.results[0]!.value });
    expect(backend.lookupTagDefinition).toHaveBeenCalledWith("ai generated");
  });

  it("derives ExHentai site selection from a supplied URL", async () => {
    const backend = {
      getGalleryPages: vi.fn(async () => ({ totalPages: 1, pages: [] })),
    };
    const server = createServer(backend as never);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    closeables.push(client, server);

    const result = await client.callTool({
      name: "eh_get_gallery_pages",
      arguments: { galleryUrl: "https://exhentai.org/g/123/123456789a/?p=2" },
    });

    expect(result.isError).not.toBe(true);
    expect(backend.getGalleryPages).toHaveBeenCalledWith(
      { gid: 123, token: "123456789a" },
      "exhentai",
      2,
    );
  });
});
