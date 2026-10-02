import { load } from "cheerio";
import type { EhSite, ImagePageResult } from "../types.js";
import { EhError } from "../errors.js";
import { assertNotChallengePage } from "./shared.js";

function absoluteUrl(value: string | undefined, site: EhSite): string | null {
  if (!value) return null;
  return new URL(value, site === "exhentai" ? "https://exhentai.org" : "https://e-hentai.org").toString();
}

export function parseImagePage(html: string, site: EhSite = "e-hentai"): ImagePageResult {
  assertNotChallengePage(html, site);
  if (/You have (?:exceeded|reached) (?:your |the )?image viewing limits|image limit has been reached/i.test(html) || /image limit[\s\S]*(?:insufficient GP|do not have sufficient GP|requires GP|do not have enough)/i.test(html)) {
    throw new EhError("RATE_LIMITED", "E-Hentai image quota exhausted; stop image requests and wait for quota recovery", { retryable: false, site, stage: "image-page" });
  }
  const $ = load(html);
  const imageUrl = $("#img").attr("src") ?? $("#i3 img").attr("src");
  if (!imageUrl) throw new Error("Could not find an image URL on the E-Hentai page");
  const resolvedImageUrl = absoluteUrl(imageUrl, site)!;
  if (/\/(?:g|img)\/509s?\.gif$/i.test(new URL(resolvedImageUrl).pathname)) {
    throw new EhError("RATE_LIMITED", "E-Hentai image quota exhausted; stop image requests and wait for quota recovery", { retryable: false, site, stage: "image-page" });
  }
  const previousPageUrl = absoluteUrl($("a#prev[href*='/s/']").first().attr("href"), site);
  const nextPageUrl = absoluteUrl($("a#next[href*='/s/']").first().attr("href"), site);
  const showKey = /var\s+showkey\s*=\s*["']([0-9a-z]+)["']/i.exec(html)?.[1] ?? null;
  const skipHathKey = /onclick=["'][^"']*\bnl\(['"]([^'"]+)['"]\)/i.exec(html)?.[1] ?? null;
  const originalImageLink = $("a[href*='/fullimg/'], a[href*='fullimg.php']").first().attr("href");
  return { imageUrl: resolvedImageUrl, originalImageUrl: absoluteUrl(originalImageLink, site), showKey, skipHathKey, nextPageUrl, previousPageUrl };
}
