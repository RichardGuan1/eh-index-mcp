import { load } from "cheerio";
import type { EhSite, GalleryPagesResult } from "../types.js";
import { parsePageUrl } from "../urls.js";
import { assertNotChallengePage } from "./shared.js";

export function parseGalleryPages(html: string, site: EhSite = "e-hentai"): GalleryPagesResult {
  assertNotChallengePage(html, site);
  const $ = load(html);
  const totalMatch = $("#gdd").text().match(/Length:\s*(\d+)\s+pages?/i);
  if (!totalMatch) throw new Error("Could not determine the gallery page count");
  const baseUrl = site === "exhentai" ? "https://exhentai.org" : "https://e-hentai.org";
  const pages = $("#gdt a[href*='/s/']").map((_, anchor) => {
    const href = new URL($(anchor).attr("href")!, baseUrl).toString();
    const ref = parsePageUrl(href);
    const child = $(anchor).find("div").first();
    const style = child.attr("style") ?? "";
    const image = $(anchor).find("img").first();
    const background = /url\((?:["']?)(https?:\/\/[^)'"\s]+)(?:["']?)\)/i.exec(style);
    const offset = /\)\s+-(\d+)px\s+/i.exec(style);
    return { page: ref.page, pageToken: ref.pageToken, url: href, thumbnailUrl: image.attr("src") ?? image.attr("data-src") ?? background?.[1] ?? null, thumbnailOffsetX: offset ? Number(offset[1]) : null };
  }).get();
  return { totalPages: Number(totalMatch[1]), pages };
}
