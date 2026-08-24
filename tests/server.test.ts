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
      "eh_find_similar_galleries",
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
      "eh_search_galleries_batch",
      "eh_search_gallery_works",
      "eh_search_translated_tags",
      "eh_search_watched",
    ]);
    expect(tools.tools.every((tool) => Boolean(tool.annotations))).toBe(true);
    expect(tools.tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
    expect(tools.tools.every((tool) => tool.annotations?.destructiveHint === false)).toBe(true);
    expect(tools.tools.every((tool) => tool.annotations?.idempotentHint === true)).toBe(true);
    expect(tools.tools.every((tool) => tool.outputSchema !== undefined)).toBe(true);

    const descriptions = new Map(tools.tools.map((tool) => [tool.name, tool.description ?? ""]));
    expect(descriptions.get("eh_search_galleries")).toContain("eh_search_translated_tags");
    expect(descriptions.get("eh_get_popular")).toContain("base URL");
    expect(descriptions.get("eh_get_gallery_metadata")).toContain("eh_get_gallery_detail");
    expect(descriptions.get("eh_get_gallery_detail")).toContain("eh_get_gallery_comments");
    expect(descriptions.get("eh_get_gallery_detail")).toContain("eh_get_torrents");
    expect(descriptions.get("eh_get_gallery_chain")).toContain("tool errors");
    expect(descriptions.get("eh_find_latest_gallery_version")).toContain("eh_get_gallery_chain");

    const missingInputDescriptions = tools.tools.flatMap((tool) => {
      const inputSchema = tool.inputSchema as { properties?: Record<string, { description?: string }> };
      return Object.entries(inputSchema.properties ?? {})
        .filter(([, schema]) => !schema.description)
        .map(([name]) => `${tool.name}.${name}`);
    });
    expect(missingInputDescriptions).toEqual([]);

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

  it("advertises gallery descriptions as untrusted structured detail content", async () => {
    const server = createServer({} as never);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    closeables.push(client, server);

    const tools = await client.listTools();
    const detail = tools.tools.find((tool) => tool.name === "eh_get_gallery_detail");
    const outputSchema = detail?.outputSchema as {
      properties?: { result?: { properties?: { description?: unknown } } };
    };
    const descriptionSchema = outputSchema.properties?.result?.properties?.description;
    expect(descriptionSchema).toBeDefined();
    expect(JSON.stringify(descriptionSchema)).toContain('"untrusted"');
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
      searchTranslatedTags: vi.fn(async () => ({
        source: {
          repository: "https://github.com/EhTagTranslation/Database" as const,
          revision: "0123456789abcdef0123456789abcdef01234567",
          version: 7,
          license: "CC BY-NC-SA 3.0 CN" as const,
        },
        untrusted: true as const,
        matches: [{
          namespace: "mixed",
          tag: "ffm threesome",
          translatedName: "女男女3P",
          intro: "2 女 1 男。",
          searchQuery: 'mixed:"ffm threesome"$',
          match: "name-contains" as const,
        }],
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

    const translations = await client.callTool({
      name: "eh_search_translated_tags",
      arguments: { query: "3P", limit: 10 },
    });
    expect(translations.structuredContent).toEqual({ result: await backend.searchTranslatedTags.mock.results[0]!.value });
    expect(backend.searchTranslatedTags).toHaveBeenCalledWith("3P", 10);
  });

  it("routes organized multi-page gallery work searches", async () => {
    const result = {
      pagesScanned: 2,
      searchedGalleryCount: 3,
      galleryCount: 2,
      uniqueWorkCount: 1,
      seriesCount: 1,
      truncated: true,
      next: "cursor-3",
      series: [{
        key: "series",
        title: "Mitsuha ~Chapter",
        creators: ["group:syukurin"],
        works: [{
          key: "work",
          title: "Mitsuha ~Chapter 10~",
          installment: "10",
          creators: ["group:syukurin"],
          availableLanguages: ["chinese"],
          groupingConfidence: "high" as const,
          groupingBasis: "normalized-title-and-creator" as const,
          groupingExplanation: "Grouped using a normalized title and shared creator tags; this is heuristic.",
          preferredGallery: { gid: 1, token: "123456789a", url: "https://e-hentai.org/g/1/123456789a/", title: "Title", titleJpn: null, category: "Doujinshi", posted: null, pages: 50, rating: 4.5, languages: [] },
          variants: [],
        }],
      }],
    };
    const backend = { searchGalleryWorks: vi.fn(async () => result) };
    const server = createServer(backend as never);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    closeables.push(client, server);

    const response = await client.callTool({ name: "eh_search_gallery_works", arguments: { query: "test", maxPages: 2 } });

    expect(response.structuredContent).toEqual({ result });
    expect(backend.searchGalleryWorks).toHaveBeenCalledWith(expect.objectContaining({ site: "e-hentai", query: "test", maxPages: 2 }));
  });

  it("routes authenticated watched-tag searches", async () => {
    const result = { galleries: [], prev: null, next: "cursor-2" };
    const backend = { searchWatched: vi.fn(async () => result) };
    const server = createServer(backend as never);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    closeables.push(client, server);

    const response = await client.callTool({
      name: "eh_search_watched",
      arguments: { site: "exhentai", query: "language:chinese$", minRating: 4, next: "cursor-1" },
    });

    expect(response.structuredContent).toEqual({ result });
    expect(backend.searchWatched).toHaveBeenCalledWith(expect.objectContaining({
      site: "exhentai",
      query: "language:chinese$",
      minRating: 4,
      next: "cursor-1",
    }));
  });

  it("routes controlled multi-page gallery searches", async () => {
    const result = { galleries: [], pagesScanned: 2, resultCount: 0, truncated: true, next: "cursor-3" };
    const backend = { searchBatch: vi.fn(async () => result) };
    const server = createServer(backend as never);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    closeables.push(client, server);

    const response = await client.callTool({
      name: "eh_search_galleries_batch",
      arguments: { site: "exhentai", query: "test", maxPages: 2, next: "cursor-1" },
    });

    expect(response.structuredContent).toEqual({ result });
    expect(backend.searchBatch).toHaveBeenCalledWith(expect.objectContaining({
      site: "exhentai",
      query: "test",
      maxPages: 2,
      next: "cursor-1",
    }));
  });

  it("routes EhViewer-compatible similar gallery searches", async () => {
    const gallery = { gid: 123, token: "123456789a" };
    const result = {
      strategy: "title" as const,
      query: '"Main Story"',
      result: { galleries: [], prev: null, next: null },
    };
    const backend = { findSimilarGalleries: vi.fn(async () => result) };
    const server = createServer(backend as never);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    closeables.push(client, server);

    const response = await client.callTool({
      name: "eh_find_similar_galleries",
      arguments: { galleryUrl: "https://exhentai.org/g/123/123456789a/" },
    });

    expect(response.structuredContent).toEqual({ result });
    expect(backend.findSimilarGalleries).toHaveBeenCalledWith(gallery, "exhentai");
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
