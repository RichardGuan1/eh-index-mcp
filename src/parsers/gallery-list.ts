import { load, type CheerioAPI } from "cheerio";
import type { EhSite, GalleryListResult, GallerySummary } from "../types.js";
import { parseGalleryUrl } from "../urls.js";
import { assertNotChallengePage, numberFromText } from "./shared.js";

function cursorFromHref(href: string | undefined, key: "prev" | "next"): string | null {
  if (!href) return null;
  return new URL(href, "https://e-hentai.org").searchParams.get(key);
}

function parseRating($: CheerioAPI, element: unknown): number | null {
  const rating = $(element as never).find(".ir").first();
  const titleValue = Number.parseFloat(rating.attr("title") ?? "");
  if (Number.isFinite(titleValue)) return titleValue;
  const values = [...(rating.attr("style") ?? "").matchAll(/(\d+)px/g)].map((match) => Number(match[1]));
  if (values.length < 2) return null;
  const base = 5 - Math.floor(values[0]! / 16);
  return values[1] === 21 ? base - 0.5 : base;
}

function parseGalleryRow($: CheerioAPI, element: unknown, site: EhSite): GallerySummary | null {
  const row = $(element as never);
  const href = row.find(".glname a[href*='/g/'], a[href*='/g/']").first().attr("href");
  if (!href) return null;
  const baseUrl = site === "exhentai" ? "https://exhentai.org" : "https://e-hentai.org";
  let ref;
  try { ref = parseGalleryUrl(new URL(href, baseUrl).toString()); } catch { return null; }
  const pagesMatch = row.find(".glhide, .gl2m, .gl2c, .gl4c, .gl3e, .gl5t").text().match(/(\d+)\s+pages?/i);
  const thumbnail = row.find(".glthumb [data-src], .glthumb img[src], .gl1e img[data-src], .gl1e img[src], .gl3t img[data-src], .gl3t img[src]").first();
  const title = row.find(".glink").first().text().trim();
  if (!title) return null;
  return { ...ref, site, url: new URL(href, baseUrl).toString(), title, category: row.find(".cn, .cs").first().text().trim(), uploader: row.find("a[href*='/uploader/']").first().text().trim() || null, posted: row.find(`[id='posted_${ref.gid}']`).first().text().trim() || null, pages: pagesMatch ? Number(pagesMatch[1]) : null, rating: parseRating($, element), tags: row.find(".gt[title], .gtl[title]").map((_, tag) => $(tag).attr("title") ?? "").get().filter(Boolean), thumbnailUrl: thumbnail.attr("data-src") ?? thumbnail.attr("src") ?? null };
}

export function parseGalleryList(html: string, site: EhSite = "e-hentai"): GalleryListResult {
  assertNotChallengePage(html, site);
  const $ = load(html);
  const warning = $(".searchwarn").first().text().trim();
  if (warning) throw new Error(`E-Hentai search error: ${warning}`);
  const galleries = $(".itg > tbody > tr, .itg > tr, .itg .gl1t").map((_, row) => parseGalleryRow($, row, site)).get().filter((gallery): gallery is GallerySummary => gallery !== null);
  return { galleries, prev: cursorFromHref($("#uprev").attr("href"), "prev"), next: cursorFromHref($("#unext").attr("href"), "next") };
}
