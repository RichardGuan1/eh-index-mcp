import type { EhSite, FavoritesOptions, GalleryCategory, GalleryRef, PageRef, SearchOptions } from "./types.js";

const SITE_HOSTS: Record<EhSite, string> = {
  "e-hentai": "e-hentai.org",
  exhentai: "exhentai.org",
};

const CATEGORY_BITS: Record<GalleryCategory, number> = {
  misc: 1,
  doujinshi: 2,
  manga: 4,
  "artist-cg": 8,
  "game-cg": 16,
  "image-set": 32,
  cosplay: 64,
  "asian-porn": 128,
  "non-h": 256,
  western: 512,
};

const ALL_CATEGORIES = 1023;

export function siteHost(site: EhSite): string {
  return SITE_HOSTS[site];
}

export function galleryUrl(ref: GalleryRef, site: EhSite = "e-hentai"): string {
  return `https://${siteHost(site)}/g/${ref.gid}/${ref.token}/`;
}

export function pageUrl(ref: PageRef, site: EhSite = "e-hentai"): string {
  return `https://${siteHost(site)}/s/${ref.pageToken}/${ref.gid}-${ref.page}`;
}

export function apiUrl(site: EhSite): string {
  return site === "exhentai" ? "https://s.exhentai.org/api.php" : "https://api.e-hentai.org/api.php";
}

export function galleryTorrentsUrl(ref: GalleryRef, site: EhSite = "e-hentai"): string {
  const url = new URL(`https://${siteHost(site)}/gallerytorrents.php`);
  url.searchParams.set("gid", String(ref.gid));
  url.searchParams.set("t", ref.token);
  return url.toString();
}

export function buildHashSearchUrl(sha1: string, site: EhSite = "e-hentai"): string {
  if (!/^[0-9a-f]{40}$/i.test(sha1)) throw new Error("SHA-1 must be exactly 40 hexadecimal characters");
  const url = new URL(`https://${siteHost(site)}/`);
  url.searchParams.set("f_shash", sha1.toLowerCase());
  return url.toString();
}

export function parseGalleryUrl(value: string): GalleryRef {
  const match = /^https?:\/\/(?:e-hentai\.org|exhentai\.org)(?:\/lofi)?\/(?:g|mpv)\/(\d+)\/([0-9a-f]{10})(?:\/|$)/i.exec(value);
  if (!match) throw new Error("Expected an E-Hentai or ExHentai gallery URL");
  return { gid: Number(match[1]), token: match[2]!.toLowerCase() };
}

export function parseGalleryPreviewUrl(value: string): { ref: GalleryRef; previewPage: number } {
  const url = new URL(value);
  const ref = parseGalleryUrl(value);
  const rawPage = url.searchParams.get("p");
  if (rawPage === null || rawPage === "") return { ref, previewPage: 0 };
  const previewPage = Number(rawPage);
  if (!Number.isInteger(previewPage) || previewPage < 0) throw new Error("Gallery preview page must be a non-negative integer");
  return { ref, previewPage };
}

export function parsePageUrl(value: string): PageRef {
  const match = /^https?:\/\/(?:e-hentai\.org|exhentai\.org)\/s\/([0-9a-f]{10})\/(\d+)-(\d+)(?:[/?#]|$)/i.exec(value);
  if (!match) throw new Error("Expected an E-Hentai or ExHentai image-page URL");
  return {
    gid: Number(match[2]),
    pageToken: match[1]!.toLowerCase(),
    page: Number(match[3]),
  };
}

export function siteFromUrl(value: string): EhSite {
  const host = new URL(value).hostname.toLowerCase();
  if (host === "exhentai.org" || host === "s.exhentai.org") return "exhentai";
  if (host === "e-hentai.org" || host === "api.e-hentai.org") return "e-hentai";
  throw new Error("Expected an E-Hentai or ExHentai URL");
}

export function buildSearchUrl(options: SearchOptions): string {
  const site = options.site ?? "e-hentai";
  const url = new URL(`https://${siteHost(site)}/`);
  const params = url.searchParams;

  if (options.query) params.set("f_search", options.query);
  if (options.categories?.length) {
    const included = options.categories.reduce((mask, category) => mask | CATEGORY_BITS[category], 0);
    params.set("f_cats", String(ALL_CATEGORIES ^ included));
  }
  if (options.prev) params.set("prev", options.prev);
  if (options.next) params.set("next", options.next);
  if (options.seek) params.set("seek", options.seek);

  const advanced =
    options.hasTorrent ||
    options.browseExpunged ||
    options.disableLanguageFilter ||
    options.disableUploaderFilter ||
    options.disableTagFilter ||
    options.minRating !== undefined ||
    options.pageFrom !== undefined ||
    options.pageTo !== undefined;

  if (advanced) params.set("advsearch", "1");
  if (options.browseExpunged) params.set("f_sh", "on");
  if (options.hasTorrent) params.set("f_sto", "on");
  if (options.disableLanguageFilter) params.set("f_sfl", "on");
  if (options.disableUploaderFilter) params.set("f_sfu", "on");
  if (options.disableTagFilter) params.set("f_sft", "on");
  if (options.minRating !== undefined) {
    params.set("f_sr", "on");
    params.set("f_srdd", String(options.minRating));
  }
  if (options.pageFrom !== undefined || options.pageTo !== undefined) params.set("f_sp", "on");
  if (options.pageFrom !== undefined) params.set("f_spf", String(options.pageFrom));
  if (options.pageTo !== undefined) params.set("f_spt", String(options.pageTo));

  return url.toString();
}

export function buildWatchedUrl(options: SearchOptions): string {
  const url = new URL(buildSearchUrl(options));
  url.pathname = "/watched";
  return url.toString();
}

export function buildFavoritesUrl(options: FavoritesOptions): string {
  const site = options.site ?? "e-hentai";
  const url = new URL(`https://${siteHost(site)}/favorites.php`);
  const category = options.category ?? "all";
  if (category !== "all" && (!Number.isInteger(category) || category < 0 || category > 9)) {
    throw new Error("Favorite category must be an integer from 0 to 9, or 'all'");
  }
  url.searchParams.set("favcat", String(category));
  if (options.query) url.searchParams.set("f_search", options.query);
  if (options.prev) url.searchParams.set("prev", options.prev);
  if (options.next) url.searchParams.set("next", options.next);
  if (options.seek) url.searchParams.set("seek", options.seek);
  return url.toString();
}
