import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import type { EhBackend } from "../backend.js";
import { success, toolError } from "../helpers.js";
import {
  annotations,
  galleryBatchSearchOutputSchema,
  galleryListOutputSchema,
  searchInputShape,
} from "../schemas.js";

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
}
