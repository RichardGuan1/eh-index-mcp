import type { EhClient } from "../client.js";
import type { EhSite, FavoritesOptions, GalleryRef, PageRef, SearchOptions } from "../types.js";

export interface EhBackend {
  getGalleryMetadata(entries: GalleryRef[], site?: EhSite): ReturnType<EhClient["getGalleryMetadata"]>;
  getGalleryMetadataBatch(entries: GalleryRef[], site?: EhSite): ReturnType<EhClient["getGalleryMetadataBatch"]>;
  searchByHash(sha1: string, site?: EhSite): ReturnType<EhClient["searchByHash"]>;
  searchByFile(path: string, site?: EhSite): ReturnType<EhClient["searchByFile"]>;
  search(options: SearchOptions): ReturnType<EhClient["search"]>;
  searchBatch(options: Parameters<EhClient["searchBatch"]>[0]): ReturnType<EhClient["searchBatch"]>;
  searchWatched(options: SearchOptions): ReturnType<EhClient["searchWatched"]>;
  findSimilarGalleries(ref: GalleryRef, site?: EhSite): ReturnType<EhClient["findSimilarGalleries"]>;
  searchGalleryWorks(options: Parameters<EhClient["searchGalleryWorks"]>[0]): ReturnType<EhClient["searchGalleryWorks"]>;
  popular(site?: EhSite): ReturnType<EhClient["popular"]>;
  searchFavorites(options: FavoritesOptions): ReturnType<EhClient["searchFavorites"]>;
  getGalleryPages(ref: GalleryRef, site?: EhSite, previewPage?: number): ReturnType<EhClient["getGalleryPages"]>;
  getAllGalleryPages(ref: GalleryRef, site?: EhSite, maxImages?: number): ReturnType<EhClient["getAllGalleryPages"]>;
  getImagePage(ref: PageRef, site?: EhSite): ReturnType<EhClient["getImagePage"]>;
  getGalleryDetail(ref: GalleryRef, site?: EhSite): ReturnType<EhClient["getGalleryDetail"]>;
  getGalleryComments(ref: GalleryRef, site?: EhSite, includeHidden?: boolean): ReturnType<EhClient["getGalleryComments"]>;
  getTorrents(ref: GalleryRef, site?: EhSite): ReturnType<EhClient["getTorrents"]>;
  checkAccess(site?: EhSite): ReturnType<EhClient["checkAccess"]>;
  getGalleryChain(ref: GalleryRef, site?: EhSite): ReturnType<EhClient["getGalleryChain"]>;
  findLatestGalleryVersion(ref: GalleryRef, site?: EhSite): ReturnType<EhClient["findLatestGalleryVersion"]>;
  compareGalleryVersions(before: GalleryRef, after: GalleryRef, site?: EhSite): ReturnType<EhClient["compareGalleryVersions"]>;
  resolveGalleryToken(ref: PageRef, site?: EhSite): ReturnType<EhClient["resolveGalleryToken"]>;
  resolveGalleryTokensBatch(entries: PageRef[], site?: EhSite): ReturnType<EhClient["resolveGalleryTokensBatch"]>;
  getFavoriteCategories(site?: EhSite): ReturnType<EhClient["getFavoriteCategories"]>;
  getFavoriteDetail(ref: GalleryRef, site?: EhSite): ReturnType<EhClient["getFavoriteDetail"]>;
  getArchiveOptions(ref: GalleryRef, site?: EhSite): ReturnType<EhClient["getArchiveOptions"]>;
  lookupTagDefinition(tag: string): ReturnType<EhClient["lookupTagDefinition"]>;
  searchTranslatedTags(query: string, limit?: number): ReturnType<EhClient["searchTranslatedTags"]>;
}
