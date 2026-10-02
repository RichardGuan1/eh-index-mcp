import type { GalleryMetadata, GalleryMetadataBatchResult, GalleryRef, GalleryTokenBatchResult, GalleryTokenResolution, PageRef } from "../types.js";

export function matchMetadataEntries(metadata: GalleryMetadata[], entries: GalleryRef[]): GalleryMetadata[] {
  const refKey = ({ gid, token }: GalleryRef) => `${gid}:${token.toLowerCase()}`;
  const byKey = new Map(metadata.filter((entry) => entry.token).map((entry) => [refKey(entry as GalleryRef), entry]));
  const byGid = new Map(metadata.map((entry) => [Number(entry.gid), entry]));
  return entries.flatMap((entry) => {
    const result = byKey.get(refKey(entry)) ?? byGid.get(entry.gid);
    return result ? [result] : [];
  });
}

export function summarizeMetadataBatch(results: GalleryMetadata[], entries: GalleryRef[]): GalleryMetadataBatchResult {
  const byKey = new Map(results.map((entry) => [`${entry.gid}:${entry.token?.toLowerCase() ?? ""}`, entry]));
  const byGid = new Map(results.map((entry) => [Number(entry.gid), entry]));
  const galleries = entries.map((entry) => byKey.get(`${entry.gid}:${entry.token.toLowerCase()}`) ?? byGid.get(entry.gid) ?? { gid: entry.gid, token: entry.token, error: "E-Hentai API returned no metadata for this gallery" });
  const successCount = galleries.filter((entry) => !entry.error).length;
  return { galleries, inputCount: entries.length, successCount, errorCount: entries.length - successCount, preservedOrder: true };
}

export function pageRefKey({ gid, pageToken, page }: PageRef): string {
  return `${gid}:${pageToken.toLowerCase()}:${page}`;
}

export function summarizeTokenBatch(entries: PageRef[], resolved: Map<string, GalleryTokenResolution>): GalleryTokenBatchResult {
  const results = entries.map((entry) => resolved.get(pageRefKey(entry))!);
  const successCount = results.filter((entry) => !entry.error).length;
  return { results, inputCount: entries.length, successCount, errorCount: entries.length - successCount, preservedOrder: true };
}