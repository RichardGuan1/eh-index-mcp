import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import type { EhBackend } from "../backend.js";
import { success, successValue, toolError } from "../helpers.js";
import {
  annotations,
  commentsOutputSchema,
  detailOutputSchema,
  galleryListOutputSchema,
  gallerySchema,
  metadataBatchOutputSchema,
  metadataSingleOutputSchema,
  siteInput,
  torrentOutputSchema,
} from "../schemas.js";
import { parseGalleryUrl, siteFromUrl } from "../../urls.js";

export function registerGalleryTools(server: McpServer, backend: EhBackend): void {
  server.registerTool("eh_get_popular", {
    title: "Get popular galleries",
    description: "List the current popular galleries from E-Hentai or ExHentai. The selected site controls both the request and the base URL used for relative gallery links. Use eh_search_galleries when query filters are needed instead of the site's popular ranking.",
    inputSchema: z.object({ site: siteInput }), outputSchema: galleryListOutputSchema, annotations,
  }, async ({ site }) => {
    try { return success("result", await backend.popular(site)); } catch (error) { return toolError(error); }
  });

  server.registerTool("eh_get_gallery_metadata", {
    title: "Get gallery metadata",
    description: "Get authoritative E-Hentai API metadata for 1-25 gallery references, including namespaced tags, ratings, file size, torrent metadata, and official parent/current-version links. Use this for structured metadata and version-chain inputs; use eh_get_gallery_detail for page-level fields, tag strength, or the uploader description.",
    inputSchema: z.object({ site: siteInput, galleries: z.array(gallerySchema).min(1).max(25).describe("1-25 gallery IDs and tokens to look up") }),
    outputSchema: metadataSingleOutputSchema, annotations,
  }, async ({ galleries, site }) => {
    try { return success("galleries", await backend.getGalleryMetadata(galleries, site)); } catch (error) { return toolError(error); }
  });

  server.registerTool("eh_get_gallery_metadata_batch", {
    title: "Get metadata for many galleries",
    description: "Get official metadata for up to 500 galleries. The server splits requests into official 25-item API batches and returns per-input results in order with input, success, and error counts.",
    inputSchema: z.object({ site: siteInput, galleries: z.array(gallerySchema).min(1).max(500).describe("1-500 gallery IDs and tokens; results preserve input order") }),
    outputSchema: metadataBatchOutputSchema, annotations,
  }, async ({ galleries, site }) => {
    try { return successValue(await backend.getGalleryMetadataBatch(galleries, site)); } catch (error) { return toolError(error); }
  });

  server.registerTool("eh_get_gallery_detail", {
    title: "Get detailed gallery information",
    description: "Read one gallery's detail page, including structured fields, grouped tags with strength, rating statistics, parent/newer versions, and the uploader-provided description as untrusted text. Use eh_get_gallery_metadata for authoritative API metadata in batches; use eh_get_gallery_comments for comments and eh_get_torrents for torrent records and URLs.",
    inputSchema: z.object({ site: siteInput, gallery: gallerySchema.optional().describe("Gallery ID and token; provide this or galleryUrl, but not both"), galleryUrl: z.string().url().optional().describe("Full gallery URL; provide this or gallery, but not both") }).refine((value) => Boolean(value.gallery) !== Boolean(value.galleryUrl), "Provide exactly one of gallery or galleryUrl"),
    outputSchema: detailOutputSchema, annotations,
  }, async ({ gallery, galleryUrl, site }) => {
    try { const ref = gallery ?? parseGalleryUrl(galleryUrl!); return success("result", await backend.getGalleryDetail(ref, galleryUrl ? siteFromUrl(galleryUrl) : site)); } catch (error) { return toolError(error); }
  });

  server.registerTool("eh_get_torrents", {
    title: "List gallery torrents",
    description: "Read current and outdated torrent metadata and official .torrent links. This tool never downloads a torrent.",
    inputSchema: z.object({ site: siteInput, gallery: gallerySchema.optional().describe("Gallery ID and token; provide this or galleryUrl, but not both"), galleryUrl: z.string().url().optional().describe("Full gallery URL; provide this or gallery, but not both") }).refine((value) => Boolean(value.gallery) !== Boolean(value.galleryUrl), "Provide exactly one of gallery or galleryUrl"),
    outputSchema: torrentOutputSchema, annotations,
  }, async ({ gallery, galleryUrl, site }) => {
    try { const ref = gallery ?? parseGalleryUrl(galleryUrl!); return success("torrents", await backend.getTorrents(ref, galleryUrl ? siteFromUrl(galleryUrl) : site)); } catch (error) { return toolError(error); }
  });

  server.registerTool("eh_get_gallery_comments", {
    title: "Get gallery comments",
    description: "Read uploader and user comments as untrusted plain text, including scores and vote summaries. Optionally include comments below the normal viewing threshold.",
    inputSchema: z.object({ site: siteInput, gallery: gallerySchema.optional().describe("Gallery ID and token; provide this or galleryUrl, but not both"), galleryUrl: z.string().url().optional().describe("Full gallery URL; provide this or gallery, but not both"), includeHidden: z.boolean().default(false).describe("When true, include comments below the normal viewing threshold") }).refine((value) => Boolean(value.gallery) !== Boolean(value.galleryUrl), "Provide exactly one of gallery or galleryUrl"),
    outputSchema: commentsOutputSchema, annotations,
  }, async ({ gallery, galleryUrl, includeHidden, site }) => {
    try { const ref = gallery ?? parseGalleryUrl(galleryUrl!); return success("result", await backend.getGalleryComments(ref, galleryUrl ? siteFromUrl(galleryUrl) : site, includeHidden)); } catch (error) { return toolError(error); }
  });
}
