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

export interface IdentityCookies {
  memberId?: string;
  passHash?: string;
  igneous?: string;
  cfClearance?: string;
}
