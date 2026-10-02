import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import type { EhBackend } from "../backend.js";
import { success, toolError } from "../helpers.js";
import { annotations, archiveOptionsOutputSchema, favoriteCategoriesOutputSchema, favoriteDetailOutputSchema, galleryListOutputSchema, gallerySchema, siteInput } from "../schemas.js";
import { parseGalleryUrl, siteFromUrl } from "../../urls.js";

export function registerAccountTools(server: McpServer, backend: EhBackend): void {
  server.registerTool("eh_get_favorite_categories", {
    title: "Get favorite categories",
    description: "Read the authenticated user's ten favorite category names, counts, total, and current selection without modifying favorites.",
    inputSchema: z.object({ site: siteInput }), outputSchema: favoriteCategoriesOutputSchema, annotations,
  }, async ({ site }) => {
    try { return success("result", await backend.getFavoriteCategories(site)); } catch (error) { return toolError(error); }
  });

  server.registerTool("eh_get_favorite_detail", {
    title: "Get favorite detail",
    description: "Read one gallery's authenticated favorite state, category, note, and favorite timestamp without modifying it.",
    inputSchema: z.object({ site: siteInput, gallery: gallerySchema.optional().describe("Gallery ID and token; provide this or galleryUrl, but not both"), galleryUrl: z.string().url().optional().describe("Full gallery URL; provide this or gallery, but not both") }).refine((value) => Boolean(value.gallery) !== Boolean(value.galleryUrl), "Provide exactly one of gallery or galleryUrl"),
    outputSchema: favoriteDetailOutputSchema, annotations,
  }, async ({ gallery, galleryUrl, site }) => {
    try { const ref = gallery ?? parseGalleryUrl(galleryUrl!); return success("result", await backend.getFavoriteDetail(ref, galleryUrl ? siteFromUrl(galleryUrl) : site)); } catch (error) { return toolError(error); }
  });

  server.registerTool("eh_get_archive_options", {
    title: "Get archive options",
    description: "Read the authenticated archive page's balance, available resolutions, sizes, and costs without purchasing or returning archive keys.",
    inputSchema: z.object({ site: siteInput, gallery: gallerySchema.optional().describe("Gallery ID and token; provide this or galleryUrl, but not both"), galleryUrl: z.string().url().optional().describe("Full gallery URL; provide this or gallery, but not both") }).refine((value) => Boolean(value.gallery) !== Boolean(value.galleryUrl), "Provide exactly one of gallery or galleryUrl"),
    outputSchema: archiveOptionsOutputSchema, annotations,
  }, async ({ gallery, galleryUrl, site }) => {
    try { const ref = gallery ?? parseGalleryUrl(galleryUrl!); return success("result", await backend.getArchiveOptions(ref, galleryUrl ? siteFromUrl(galleryUrl) : site)); } catch (error) { return toolError(error); }
  });

  server.registerTool("eh_search_favorites", {
    title: "Search favorites",
    description: "Search the authenticated user's E-Hentai or ExHentai favorites by native query, favorite category, and cursor.",
    inputSchema: z.object({ site: siteInput, category: z.union([z.number().int().min(0).max(9), z.literal("all")]).default("all").describe("Favorite category index 0-9, or all categories"), query: z.string().max(200).optional().describe("Native E-Hentai favorite search query"), prev: z.string().optional().describe("Previous-page cursor returned by this tool"), next: z.string().optional().describe("Next-page cursor returned by this tool"), seek: z.string().optional().describe("E-Hentai seek value, such as a date or gallery ID") }),
    outputSchema: galleryListOutputSchema, annotations,
  }, async (input) => {
    try { return success("result", await backend.searchFavorites(input)); } catch (error) { return toolError(error); }
  });
}
