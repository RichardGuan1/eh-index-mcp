import { load, type CheerioAPI } from "cheerio";
import type { EhSite, GalleryDetailResult } from "../types.js";
import { EhError } from "../errors.js";

export function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

export function numberFromText(value: string, fallback = 0): number {
  const number = Number.parseInt(value.replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(number) ? number : fallback;
}

export function textValue($: CheerioAPI, selector: string): string | null {
  const value = $(selector).first().text().replace(/\u00a0/g, " ").trim();
  return value || null;
}

export function detailRows($: CheerioAPI): Map<string, string> {
  const rows = new Map<string, string>();
  $("#gdd tr").each((_, row) => {
    const key = $(row).find(".gdt1").first().text().trim().replace(/:$/, "");
    const value = $(row).find(".gdt2").first().text().replace(/\u00a0/g, " ").trim();
    if (key) rows.set(key, value);
  });
  return rows;
}

export function galleryDescription($: CheerioAPI): GalleryDetailResult["description"] {
  const node = $("#gld").first().clone();
  if (!node.length) return null;
  node.find("script, style, noscript").remove();
  node.find("br").replaceWith("\n");
  const text = node.text().replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return text ? { text, untrusted: true } : null;
}

export function assertNotChallengePage(html: string, site: EhSite = "e-hentai"): void {
  if (/Just a moment|challenge-platform|cf-chl-|cf_chl_/i.test(html)) {
    throw new EhError("CLOUDFLARE_CHALLENGE", "E-Hentai returned a Cloudflare challenge page; refresh the browser session or EH_CF_CLEARANCE cookie", { retryable: false, site, stage: "html-parser" });
  }
  if (/<title>\s*E-Hentai\.org Login\s*<\/title>|name=["']ipb_login_form["']/i.test(html)) {
    throw new EhError("AUTH_REJECTED", "E-Hentai returned a login page; credentials expired or were rejected", { retryable: false, site, stage: "html-parser" });
  }
  const banMatch = html.match(/Your IP address has been temporarily banned for excessive pageloads[\s\S]*?The ban expires in\s+([^<\r\n]+)/i);
  if (banMatch) {
    throw new EhError("RATE_LIMITED", `E-Hentai IP temporarily banned for ${banMatch[1]!.trim()}; stop requests until the ban expires`, { retryable: false, site, stage: "html-parser" });
  }
}
