import type { GalleryBatchSearchResult, GalleryListResult, GallerySummary } from "../types.js";

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
