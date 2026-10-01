import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import type { EhBackend } from "../backend.js";
import { success, toolError } from "../helpers.js";
import {
  annotations,
  capabilitiesOutputSchema,
  fileSearchOutputSchema,
  galleryBatchSearchOutputSchema,
  galleryListOutputSchema,
  queryOutputSchema,
  searchInputShape,
  siteInput,
  gallerySchema,
  similarGalleryOutputSchema,
  galleryWorkSearchOutputSchema,
} from "../schemas.js";
import { parseGalleryUrl, siteFromUrl } from "../../urls.js";
import { buildStructuredSearchQuery, getSearchCapabilities } from "../../search-tools.js";

export function registerSearchTools(server: McpServer, backend: EhBackend): void {
  server.registerTool(
    "eh_search_galleries",
    {
      title: "Search E-Hentai galleries",
      description: "Search E-Hentai or ExHentai with native title and tag syntax plus optional category, rating, page-count, torrent, expunged, and cursor filters. Use namespace-qualified tags such as artist:name or female:tag when needed. For translated Chinese or English tag names, resolve the native tag token with eh_search_translated_tags first; native tags can be passed directly.",
      inputSchema: z.object({
        ...searchInputShape,
        prev: z.string().optional().describe("Previous-page cursor returned by this tool"),
        next: z.string().optional().describe("Next-page cursor returned by this tool"),
        seek: z.string().optional().describe("E-Hentai seek value, such as a date or gallery ID"),
      }),
      outputSchema: galleryListOutputSchema,
      annotations,
    },
    async (input) => {
      try { return success("result", await backend.search(input)); } catch (error) { return toolError(error); }
    },
  );

  server.registerTool(
    "eh_search_galleries_batch",
    {
      title: "Search galleries across pages",
      description: "Search up to 10 result pages without metadata expansion, deduplicate gallery references, and return a resume cursor when the page budget truncates the scan.",
      inputSchema: z.object({
        ...searchInputShape,
        maxPages: z.number().int().min(1).max(10).default(5).describe("Maximum result pages to scan"),
        next: z.string().optional().describe("Resume cursor returned by a previous truncated batch search"),
      }),
      outputSchema: galleryBatchSearchOutputSchema,
      annotations,
    },
    async (input) => {
      try { return success("result", await backend.searchBatch(input)); } catch (error) { return toolError(error); }
    },
  );

  server.registerTool(
    "eh_search_watched",
    {
      title: "Search watched-tag galleries",
      description: "Read the authenticated user's watched-tag gallery feed with native search, category, advanced-filter, and cursor controls. This tool never changes watched tags or account settings.",
      inputSchema: z.object({
        ...searchInputShape,
        prev: z.string().optional().describe("Previous-page cursor returned by this tool"),
        next: z.string().optional().describe("Next-page cursor returned by this tool"),
        seek: z.string().optional().describe("E-Hentai seek value, such as a date or gallery ID"),
      }),
      outputSchema: galleryListOutputSchema,
      annotations,
    },
    async (input) => {
      try { return success("result", await backend.searchWatched(input)); } catch (error) { return toolError(error); }
    },
  );

  server.registerTool(
    "eh_search_by_hash",
    {
      title: "Search by image SHA-1",
      description: "Search E-Hentai by an exact 40-character SHA-1 image hash without uploading the image.",
      inputSchema: z.object({ site: siteInput, sha1: z.string().regex(/^[0-9a-f]{40}$/i).describe("Exact 40-character hexadecimal SHA-1 hash of an image") }),
      outputSchema: galleryListOutputSchema,
      annotations,
    },
    async ({ sha1, site }) => {
      try { return success("result", await backend.searchByHash(sha1, site)); } catch (error) { return toolError(error); }
    },
  );

  server.registerTool(
    "eh_search_by_file",
    {
      title: "Search by local image file",
      description: "Read one explicitly provided absolute local file, calculate SHA-1 locally, and perform exact image search. The file is never uploaded.",
      inputSchema: z.object({ site: siteInput, path: z.string().min(1).describe("Absolute path to one user-selected regular file; directories and wildcards are rejected") }),
      outputSchema: fileSearchOutputSchema,
      annotations,
    },
    async ({ path, site }) => {
      try { return success("result", await backend.searchByFile(path, site)); } catch (error) { return toolError(error); }
    },
  );

  server.registerTool(
    "eh_build_search_query",
    {
      title: "Build an E-Hentai search query",
      description: "Build and validate native search syntax from structured include, exclude, OR, exact-tag, and title conditions without making a network request.",
      inputSchema: z.object({
        includeTags: z.array(z.string()).max(5).optional().describe("Up to 5 tags that every result must include"),
        excludeTags: z.array(z.string()).max(10).optional().describe("Up to 10 tags that results must exclude"),
        orTags: z.array(z.string()).max(10).optional().describe("Up to 10 tags combined as an OR condition"),
        title: z.string().optional().describe("Optional title condition"),
        exactTags: z.boolean().default(false).describe("Use exact tag matching when true"),
      }),
      outputSchema: queryOutputSchema,
      annotations,
    },
    async (input) => {
      try { return success("result", buildStructuredSearchQuery(input)); } catch (error) { return toolError(error); }
    },
  );

  server.registerTool(
    "eh_get_search_capabilities",
    {
      title: "Get E-Hentai search capabilities",
      description: "Return supported categories, namespaces, qualifiers, operators, and official query limits without making a network request.",
      inputSchema: z.object({}),
      outputSchema: capabilitiesOutputSchema,
      annotations,
    },
    async () => success("result", getSearchCapabilities()),
  );

  server.registerTool(
    "eh_find_similar_galleries",
    {
      title: "Find similar galleries",
      description: "Find galleries using EhViewer's strategy: extract a structural title and run an exact quoted search, falling back to the first artist tag and then the uploader when no title remains.",
      inputSchema: z.object({ site: siteInput, gallery: gallerySchema.optional().describe("Gallery ID and token; provide this or galleryUrl, but not both"), galleryUrl: z.string().url().optional().describe("Full gallery URL; provide this or gallery, but not both") }).refine((value) => Boolean(value.gallery) !== Boolean(value.galleryUrl), "Provide exactly one of gallery or galleryUrl"),
      outputSchema: similarGalleryOutputSchema,
      annotations,
    },
    async ({ gallery, galleryUrl, site }) => {
      try { const ref = gallery ?? parseGalleryUrl(galleryUrl!); return success("result", await backend.findSimilarGalleries(ref, galleryUrl ? siteFromUrl(galleryUrl) : site)); } catch (error) { return toolError(error); }
    },
  );

  server.registerTool(
    "eh_search_gallery_works",
    {
      title: "Search and organize gallery works",
      description: "Search up to 10 result pages, fetch official metadata, merge official version links and likely language/upload variants into works, then group installments into series. galleryCount counts unique gallery uploads; uniqueWorkCount is heuristic and every work includes a confidence level plus all source galleries.",
      inputSchema: z.object({ ...searchInputShape, maxPages: z.number().int().min(1).max(10).default(5).describe("Maximum result pages to scan; each page consumes one rate-limited search request"), next: z.string().optional().describe("Resume cursor returned by a previous truncated work search") }),
      outputSchema: galleryWorkSearchOutputSchema,
      annotations,
    },
    async (input) => { try { return success("result", await backend.searchGalleryWorks(input)); } catch (error) { return toolError(error); } },
  );
}
