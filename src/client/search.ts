import type { GalleryBatchSearchResult, GalleryListResult, GallerySummary, GalleryMetadata, GalleryRef, GalleryVersionComparison } from "../types.js";

export async function collectGallerySearchPages(
  options: { maxPages?: number; next?: string },
  search: (options: Record<string, unknown>) => Promise<GalleryListResult>,
): Promise<{ galleries: GallerySummary[]; pagesScanned: number; next: string | null }> {
  const maxPages = options.maxPages ?? 5;
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 10) {
    throw new Error("maxPages must be an integer from 1 to 10");
  }
  const { maxPages: _maxPages, next: initialNext, ...searchOptions } = options as Record<string, unknown>;
  const galleries: GallerySummary[] = [];
  const seenCursors = new Set<string>();
  let next = (initialNext as string | undefined) ?? null;
  let pagesScanned = 0;

  for (; pagesScanned < maxPages; pagesScanned += 1) {
    if (next) {
      if (seenCursors.has(next)) throw new Error(`Search cursor repeated: ${next}`);
      seenCursors.add(next);
    }
    const page = await search({ ...searchOptions, ...(next ? { next } : {}) });
    galleries.push(...page.galleries);
    next = page.next;
    if (!next) {
      pagesScanned += 1;
      break;
    }
  }
  return { galleries, pagesScanned, next };
}

export function deduplicateGallerySummaries(galleries: GallerySummary[]): GallerySummary[] {
  return [...new Map(galleries.map((gallery) => [`${gallery.gid}:${gallery.token.toLowerCase()}`, gallery])).values()];
}

export function toBatchSearchResult(galleries: GallerySummary[], pagesScanned: number, next: string | null): GalleryBatchSearchResult {
  const unique = deduplicateGallerySummaries(galleries);
  return { galleries: unique, inputCount: unique.length, pagesScanned, resultCount: unique.length, errorCount: 0, preservedOrder: true, truncated: next !== null, next };
}

export function addGalleryCandidate(candidates: Map<number, GalleryRef>, gid: string | number | undefined, token: string | undefined): void {
  const numeric = Number(gid);
  if (Number.isInteger(numeric) && numeric > 0 && token && !candidates.has(numeric)) candidates.set(numeric, { gid: numeric, token });
}

export function compareGalleryMetadata(before: GalleryMetadata, after: GalleryMetadata): GalleryVersionComparison["changes"] {
  const numberValue = (value: string | number | undefined): number | null => { const numeric = Number(value); return Number.isFinite(numeric) ? numeric : null; };
  const beforeCount = numberValue(before.filecount); const afterCount = numberValue(after.filecount); const beforeSize = numberValue(before.filesize); const afterSize = numberValue(after.filesize);
  const beforeTags = new Set(before.tags ?? []); const afterTags = new Set(after.tags ?? []);
  return { title: { before: before.title ?? null, after: after.title ?? null }, posted: { before: before.posted ?? null, after: after.posted ?? null }, filecount: { before: beforeCount, after: afterCount, delta: beforeCount !== null && afterCount !== null ? afterCount - beforeCount : null }, filesize: { before: beforeSize, after: afterSize, delta: beforeSize !== null && afterSize !== null ? afterSize - beforeSize : null }, tagsAdded: [...afterTags].filter((tag) => !beforeTags.has(tag)).sort(), tagsRemoved: [...beforeTags].filter((tag) => !afterTags.has(tag)).sort() };
}
