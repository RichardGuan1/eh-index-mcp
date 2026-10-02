import type { EhSite, GalleryRef, GalleryPagesResult } from "../types.js";

export function tagDefinitionCacheKey(tag: string): string {
  return `tag-definition:${tag.replace(/\s+/g, "_").toLowerCase()}`;
}

export function tagDefinitionUrl(tag: string): string {
  return `https://ehwiki.org/wiki/${encodeURIComponent(tag.replace(/\s+/g, "_"))}`;
}

export function galleryCacheKey(kind: string, site: EhSite, ref: GalleryRef, suffix = ""): string {
  return `${kind}:${site}:${ref.gid}:${ref.token}${suffix}`;
}

export function popularCacheKey(site: EhSite): string {
  return `popular:${site}`;
}

export function galleryPagesCacheKey(site: string, gid: number, token: string, previewPage: number): string {
  return `pages:${site}:${gid}:${token}:${previewPage}`;
}

export function imagePageCacheKey(site: string, gid: number, pageToken: string, page: number): string {
  return `image:${site}:${gid}:${pageToken}:${page}`;
}

export function combineGalleryPages(batches: GalleryPagesResult[], totalPages: number, previewPagesFetched: number) {
  const pages = [...new Map(batches.flatMap((batch) => batch.pages).map((page) => [page.page, page])).values()]
    .sort((left, right) => left.page - right.page)
    .filter((page) => page.page <= totalPages);
  if (pages.length !== totalPages) {
    throw new Error(`Gallery page enumeration incomplete: expected ${totalPages}, received ${pages.length}`);
  }
  return { totalPages, pages, previewPagesFetched };
}
