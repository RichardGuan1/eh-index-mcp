import type { GalleryTokenBatchResult, GalleryTokenResolution, PageRef } from "../types.js";

export function pageRefKey({ gid, pageToken, page }: PageRef): string {
  return `${gid}:${pageToken.toLowerCase()}:${page}`;
}

export function summarizeTokenBatch(entries: PageRef[], resolved: Map<string, GalleryTokenResolution>): GalleryTokenBatchResult {
  const results = entries.map((entry) => resolved.get(pageRefKey(entry))!);
  const successCount = results.filter((entry) => !entry.error).length;
  return {
    results,
    inputCount: entries.length,
    successCount,
    errorCount: entries.length - successCount,
    preservedOrder: true,
  };
}
