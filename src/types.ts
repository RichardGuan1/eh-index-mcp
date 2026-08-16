export type EhSite = "e-hentai" | "exhentai";

export type GalleryCategory =
  | "misc"
  | "doujinshi"
  | "manga"
  | "artist-cg"
  | "game-cg"
  | "western"
  | "non-h"
  | "image-set"
  | "cosplay"
  | "asian-porn";

export interface GalleryRef {
  gid: number;
  token: string;
}

export interface PageRef {
  gid: number;
  pageToken: string;
  page: number;
}

export interface GalleryTokenResolution extends PageRef {
  token?: string;
  error?: string;
}

export interface SearchOptions {
  site?: EhSite;
  query?: string;
  categories?: GalleryCategory[];
  minRating?: number;
  pageFrom?: number;
  pageTo?: number;
  hasTorrent?: boolean;
  browseExpunged?: boolean;
  disableLanguageFilter?: boolean;
  disableUploaderFilter?: boolean;
  disableTagFilter?: boolean;
  prev?: string;
  next?: string;
  seek?: string;
}

export interface FavoritesOptions {
  site?: EhSite;
  category?: number | "all";
  query?: string;
  prev?: string;
  next?: string;
  seek?: string;
}

export interface FavoriteCategory {
  index: number;
  name: string;
  count: number;
}

export interface FavoriteCategoriesResult {
  total: number;
  selected: number | "all";
  categories: FavoriteCategory[];
}

export interface FavoriteDetailResult {
  gallery: GalleryRef;
  favorited: boolean;
  category: { index: number; name: string } | null;
  note: string | null;
  favoritedAt: string | null;
}

export interface GallerySummary extends GalleryRef {
  url: string;
  title: string;
  category: string;
  uploader: string | null;
  posted: string | null;
  pages: number | null;
  rating: number | null;
  tags: string[];
  thumbnailUrl: string | null;
}

export interface GalleryListResult {
  galleries: GallerySummary[];
  prev: string | null;
  next: string | null;
}

export interface FileSearchResult {
  path: string;
  size: number;
  sha1: string;
  result: GalleryListResult;
}

export interface ImagePageResult {
  imageUrl: string;
  originalImageUrl: string | null;
  showKey: string | null;
  skipHathKey: string | null;
  nextPageUrl: string | null;
  previousPageUrl: string | null;
}

export interface GalleryPagePreview {
  page: number;
  pageToken: string;
  url: string;
  thumbnailUrl: string | null;
  thumbnailOffsetX: number | null;
}

export interface GalleryPagesResult {
  totalPages: number;
  pages: GalleryPagePreview[];
}

export interface AllGalleryPagesResult extends GalleryPagesResult {
  previewPagesFetched: number;
}

export type GalleryTagStrength = "solid" | "weak" | "active";

export interface GalleryTagDetail {
  name: string;
  strength: GalleryTagStrength;
}

export interface GalleryTagGroup {
  namespace: string;
  tags: GalleryTagDetail[];
}

export interface GalleryNewerVersion extends GalleryRef {
  title: string;
  added: string;
}

export interface GalleryDetailSummary {
  gid: number;
  token: string;
  title: string;
  titleJpn: string | null;
  category: string;
  uploader: string | null;
  posted: string | null;
  parent: GalleryRef | null;
  visible: string | null;
  language: string | null;
  fileSize: string | null;
  pages: number | null;
  favoriteCount: number;
  rating: number | null;
  ratingCount: number | null;
  torrentCount: number;
}

export interface GalleryDetailResult {
  gallery: GalleryDetailSummary;
  tagGroups: GalleryTagGroup[];
  newerVersions: GalleryNewerVersion[];
}

export interface GalleryTorrent {
  id: number;
  name: string;
  url: string;
  posted: string;
  size: string;
  seeds: number;
  peers: number;
  downloads: number;
  uploader: string | null;
  outdated: boolean;
}

export interface GalleryComment {
  id: number;
  author: string | null;
  posted: string | null;
  score: number | null;
  uploaderComment: boolean;
  text: string;
  votes: string | null;
  untrusted: true;
}

export interface GalleryCommentsResult {
  comments: GalleryComment[];
  includeHidden: boolean;
}

export interface AccessDiagnostics {
  site: EhSite;
  reachable: boolean | null;
  credentialsProvided: boolean;
  authenticated: boolean | null;
  cloudflareChallenge: boolean;
  status: number | null;
  message: string;
}

export interface ArchiveOption {
  kind: "original" | "resample" | "hath";
  resolution: string;
  size: string;
  cost: string;
}

export interface ArchiveOptionsResult {
  balance: string | null;
  options: ArchiveOption[];
}

export interface IdentityCookies {
  memberId?: string;
  passHash?: string;
  igneous?: string;
  cfClearance?: string;
}

export interface TorrentMetadata {
  hash: string;
  added: string;
  name: string;
  tsize: string;
  fsize: string;
}

export interface GalleryMetadata {
  gid: number;
  token?: string;
  title?: string;
  title_jpn?: string;
  category?: string;
  thumb?: string;
  uploader?: string;
  posted?: string;
  filecount?: string;
  filesize?: number;
  expunged?: boolean;
  rating?: string;
  torrentcount?: string;
  torrents?: TorrentMetadata[];
  tags?: string[];
  parent_gid?: string;
  parent_key?: string;
  current_gid?: string;
  current_key?: string;
  first_gid?: string;
  first_key?: string;
  error?: string;
}

export interface TagDefinitionResult {
  title: string;
  description: string | null;
  tagType: string | null;
  slaveTags: string[];
  notes: string | null;
  sourceUrl: string;
  untrusted: true;
}

export interface GalleryVersionComparison {
  before: GalleryMetadata;
  after: GalleryMetadata;
  changes: {
    title: { before: string | null; after: string | null };
    posted: { before: string | null; after: string | null };
    filecount: { before: number | null; after: number | null; delta: number | null };
    filesize: { before: number | null; after: number | null; delta: number | null };
    tagsAdded: string[];
    tagsRemoved: string[];
  };
}
