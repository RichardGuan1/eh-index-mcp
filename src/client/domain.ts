import type { EhSite, GalleryRef, PageRef } from "../types.js";

export function tagDefinitionCacheKey(tag: string): string {
  return `tag-definition:${tag.replace(/\s+/g, "_").toLowerCase()}`;
}

export function tagDefinitionUrl(tag: string): string {
  return `https://ehwiki.org/wiki/${encodeURIComponent(tag.replace(/\s+/g, "_"))}`;
}

export function galleryCacheKey(kind: string, site: EhSite, ref: GalleryRef, suffix = ""): string {
  return `${kind}:${site}:${ref.gid}:${ref.token}${suffix}`;
}

export function pageCacheKey(kind: string, site: EhSite, ref: PageRef): string {
  return `${kind}:${site}:${ref.gid}:${ref.pageToken}:${ref.page}`;
}
