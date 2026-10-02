import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import type { EhBackend } from "../backend.js";
import { success, successValue, toolError } from "../helpers.js";
import { annotations, allPagesOutputSchema, galleryPagesOutputSchema, gallerySchema, imagePageOutputSchema, pageSchema, resolvedGalleryBatchOutputSchema, resolvedGalleryOutputSchema, siteInput } from "../schemas.js";
import { parseGalleryPreviewUrl, parseGalleryUrl, parsePageUrl, siteFromUrl } from "../../urls.js";

export function registerPageTools(server: McpServer, backend: EhBackend): void {
  server.registerTool("eh_get_all_gallery_pages", {
    title: "Get every gallery image page",
    description: "Serially enumerate every gallery preview page and return a complete, ordered image-page list without downloading images.",
    inputSchema: z.object({ site: siteInput, gallery: gallerySchema.optional().describe("Gallery ID and token; provide this or galleryUrl, but not both"), galleryUrl: z.string().url().optional().describe("Full gallery URL; provide this or gallery, but not both"), maxImages: z.number().int().min(1).max(5000).default(500).describe("Maximum image pages to return, from 1 through 5000") }).refine((value) => Boolean(value.gallery) !== Boolean(value.galleryUrl), "Provide exactly one of gallery or galleryUrl"),
    outputSchema: allPagesOutputSchema, annotations,
  }, async ({ gallery, galleryUrl, maxImages, site }) => {
    try { const ref = gallery ?? parseGalleryUrl(galleryUrl!); return success("result", await backend.getAllGalleryPages(ref, galleryUrl ? siteFromUrl(galleryUrl) : site, maxImages)); } catch (error) { return toolError(error); }
  });

  server.registerTool("eh_get_gallery_pages", {
    title: "Get gallery image pages",
    description: "List image-page numbers, page tokens, URLs, and preview thumbnails from one gallery preview page.",
    inputSchema: z.object({ site: siteInput, gallery: gallerySchema.optional().describe("Gallery ID and token; provide this or galleryUrl, but not both"), galleryUrl: z.string().url().optional().describe("Alternative to gallery: full E-Hentai gallery URL; provide this or gallery, but not both"), previewPage: z.number().int().min(0).optional().describe("Zero-based gallery preview page; overrides ?p=N in galleryUrl") }).refine((value) => Boolean(value.gallery) !== Boolean(value.galleryUrl), "Provide exactly one of gallery or galleryUrl"),
    outputSchema: galleryPagesOutputSchema, annotations,
  }, async ({ gallery, galleryUrl, previewPage, site }) => {
    try { const parsed = galleryUrl ? parseGalleryPreviewUrl(galleryUrl) : null; const ref = gallery ?? parsed!.ref; return success("result", await backend.getGalleryPages(ref, galleryUrl ? siteFromUrl(galleryUrl) : site, previewPage ?? parsed?.previewPage ?? 0)); } catch (error) { return toolError(error); }
  });

  server.registerTool("eh_get_image_page", {
    title: "Get one image page",
    description: "Resolve one E-Hentai image page to the displayed image URL, original-image URL when available, navigation links, and page keys.",
    inputSchema: z.object({ site: siteInput, page: pageSchema.optional().describe("Image-page reference; provide this or pageUrl, but not both"), pageUrl: z.string().url().optional().describe("Alternative to page: full E-Hentai image-page URL") }).refine((value) => Boolean(value.page) !== Boolean(value.pageUrl), "Provide exactly one of page or pageUrl"),
    outputSchema: imagePageOutputSchema, annotations,
  }, async ({ page, pageUrl: sourceUrl, site }) => {
    try { const ref = page ?? parsePageUrl(sourceUrl!); return success("result", await backend.getImagePage(ref, sourceUrl ? siteFromUrl(sourceUrl) : site)); } catch (error) { return toolError(error); }
  });

  server.registerTool("eh_resolve_gallery", {
    title: "Resolve gallery from image page",
    description: "Convert an E-Hentai image-page URL or page reference into its gallery ID and gallery token.",
    inputSchema: z.object({ site: siteInput, page: pageSchema.optional().describe("Image-page reference; provide this or pageUrl, but not both"), pageUrl: z.string().url().optional().describe("Full image-page URL; provide this or page, but not both") }).refine((value) => Boolean(value.page) !== Boolean(value.pageUrl), "Provide exactly one of page or pageUrl"),
    outputSchema: resolvedGalleryOutputSchema, annotations,
  }, async ({ page, pageUrl: sourceUrl, site }) => {
    try { const ref = page ?? parsePageUrl(sourceUrl!); return success("gallery", await backend.resolveGalleryToken(ref, sourceUrl ? siteFromUrl(sourceUrl) : site)); } catch (error) { return toolError(error); }
  });

  server.registerTool("eh_resolve_gallery_batch", {
    title: "Resolve galleries from image pages in batch",
    description: "Resolve 1-500 image-page references to gallery tokens through the official API, preserving input order and duplicates. Returns per-input results with input, success, and error counts.",
    inputSchema: z.object({ site: siteInput, pages: z.array(pageSchema).min(1).max(500).describe("1-500 image-page references to resolve") }),
    outputSchema: resolvedGalleryBatchOutputSchema, annotations,
  }, async ({ pages, site }) => {
    try { return successValue(await backend.resolveGalleryTokensBatch(pages, site)); } catch (error) { return toolError(error); }
  });
}
