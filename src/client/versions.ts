import type { GalleryMetadata, GalleryRef, GalleryVersionComparison } from "../types.js";

export function addGalleryCandidate(candidates: Map<number, GalleryRef>, gid: string | number | undefined, token: string | undefined): void {
  const numeric = Number(gid);
  if (Number.isInteger(numeric) && numeric > 0 && token && !candidates.has(numeric)) {
    candidates.set(numeric, { gid: numeric, token });
  }
}

export function compareGalleryMetadata(before: GalleryMetadata, after: GalleryMetadata): GalleryVersionComparison["changes"] {
  const numberValue = (value: string | number | undefined): number | null => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };
  const beforeCount = numberValue(before.filecount);
  const afterCount = numberValue(after.filecount);
  const beforeSize = numberValue(before.filesize);
  const afterSize = numberValue(after.filesize);
  const beforeTags = new Set(before.tags ?? []);
  const afterTags = new Set(after.tags ?? []);
  return {
    title: { before: before.title ?? null, after: after.title ?? null },
    posted: { before: before.posted ?? null, after: after.posted ?? null },
    filecount: { before: beforeCount, after: afterCount, delta: beforeCount !== null && afterCount !== null ? afterCount - beforeCount : null },
    filesize: { before: beforeSize, after: afterSize, delta: beforeSize !== null && afterSize !== null ? afterSize - beforeSize : null },
    tagsAdded: [...afterTags].filter((tag) => !beforeTags.has(tag)).sort(),
    tagsRemoved: [...beforeTags].filter((tag) => !afterTags.has(tag)).sort(),
  };
}
