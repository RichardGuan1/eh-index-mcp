import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import type { EhBackend } from "../backend.js";
import { success, toolError } from "../helpers.js";
import { annotations, chainOutputSchema, gallerySchema, latestOutputSchema, siteInput, versionComparisonOutputSchema } from "../schemas.js";
import { parseGalleryUrl, siteFromUrl } from "../../urls.js";

export function registerVersionTools(server: McpServer, backend: EhBackend): void {
  server.registerTool("eh_get_gallery_chain", {
    title: "Get gallery version chain",
    description: "Combine official API version-chain metadata with detail-page newer-version links into an ordered, deduplicated gallery version list. Provide exactly one gallery reference or full gallery URL. Deleted galleries, malformed URLs, authentication failures, challenge pages, and upstream request errors are returned as tool errors rather than silently treated as an empty chain.",
    inputSchema: z.object({ site: siteInput, gallery: gallerySchema.optional().describe("Gallery ID and token; provide this or galleryUrl, but not both"), galleryUrl: z.string().url().optional().describe("Full gallery URL; provide this or gallery, but not both") }).refine((value) => Boolean(value.gallery) !== Boolean(value.galleryUrl), "Provide exactly one of gallery or galleryUrl"),
    outputSchema: chainOutputSchema, annotations,
  }, async ({ gallery, galleryUrl, site }) => {
    try { const ref = gallery ?? parseGalleryUrl(galleryUrl!); return success("galleries", await backend.getGalleryChain(ref, galleryUrl ? siteFromUrl(galleryUrl) : site)); } catch (error) { return toolError(error); }
  });

  server.registerTool("eh_find_latest_gallery_version", {
    title: "Find latest gallery version",
    description: "Resolve one gallery's official and detail-page version chain, then return the latest semantic version. Use eh_get_gallery_chain when the complete ordered chain is needed. Invalid references, deleted galleries, authentication failures, challenge pages, and upstream errors are returned as tool errors.",
    inputSchema: z.object({ site: siteInput, gallery: gallerySchema.optional().describe("Gallery ID and token; provide this or galleryUrl, but not both"), galleryUrl: z.string().url().optional().describe("Full gallery URL; provide this or gallery, but not both") }).refine((value) => Boolean(value.gallery) !== Boolean(value.galleryUrl), "Provide exactly one of gallery or galleryUrl"),
    outputSchema: latestOutputSchema, annotations,
  }, async ({ gallery, galleryUrl, site }) => {
    try { const ref = gallery ?? parseGalleryUrl(galleryUrl!); return success("gallery", await backend.findLatestGalleryVersion(ref, galleryUrl ? siteFromUrl(galleryUrl) : site)); } catch (error) { return toolError(error); }
  });

  server.registerTool("eh_compare_gallery_versions", {
    title: "Compare gallery versions",
    description: "Compare two gallery versions by title, posted time, page count, file size, and namespaced tag additions/removals.",
    inputSchema: z.object({ site: siteInput, before: gallerySchema.describe("Earlier gallery version to compare"), after: gallerySchema.describe("Later gallery version to compare") }),
    outputSchema: versionComparisonOutputSchema, annotations,
  }, async ({ before, after, site }) => {
    try { return success("result", await backend.compareGalleryVersions(before, after, site)); } catch (error) { return toolError(error); }
  });
}
