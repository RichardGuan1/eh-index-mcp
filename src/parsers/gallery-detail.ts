import { load } from "cheerio";
import type { EhSite, GalleryDetailResult, GalleryNewerVersion, GalleryRef, GalleryTagGroup } from "../types.js";
import { parseGalleryUrl } from "../urls.js";
import { assertNotChallengePage, detailRows, galleryDescription, numberFromText, textValue } from "./shared.js";

export function parseGalleryDetail(html: string, expectedRef?: GalleryRef, site: EhSite = "e-hentai"): GalleryDetailResult {
  assertNotChallengePage(html, site);
  const $ = load(html);
  const gidMatch = /(?:var|let|const)\s+gid\s*=\s*(\d+)/i.exec(html);
  const tokenMatch = /(?:var|let|const)\s+token\s*=\s*["']([0-9a-f]{10})["']/i.exec(html);
  if (!expectedRef && (!gidMatch || !tokenMatch)) throw new Error("Could not find gallery identity on the detail page");
  const gid = expectedRef?.gid ?? Number(gidMatch![1]);
  const token = expectedRef?.token.toLowerCase() ?? tokenMatch![1]!.toLowerCase();
  const rows = detailRows($);
  const parentHref = $("#gdd .gdt1").filter((_, node) => $(node).text().trim().startsWith("Parent")).first().next().find("a").attr("href");
  let parent = null;
  if (parentHref) {
    try { parent = parseGalleryUrl(new URL(parentHref, "https://e-hentai.org").toString()); } catch { parent = null; }
  }
  const scriptRating = /(?:var|let|const)\s+average_rating\s*=\s*([\d.]+)/i.exec(html)?.[1];
  const labelRating = $("#rating_label").text().match(/Average:\s*([\d.]+)/i)?.[1];
  const tagGroups: GalleryTagGroup[] = $("#taglist tr").map((_, row) => {
    const namespace = $(row).find(".tc").first().text().trim().replace(/:$/, "");
    const tags = $(row).find("td").eq(1).find(".gt, .gtl, .gtw").map((__, tag) => ({ name: $(tag).find("a").first().text().trim(), strength: $(tag).hasClass("gtw") ? "weak" as const : $(tag).hasClass("gtl") ? "active" as const : "solid" as const })).get().filter((tag) => tag.name);
    return namespace ? { namespace, tags } : null;
  }).get().filter((group): group is GalleryTagGroup => group !== null);
  const newerVersions: GalleryNewerVersion[] = [];
  const newerPattern = /<a\s+href=["']([^"']+)["']>([\s\S]*?)<\/a>,\s*added\s+([^<]+)/gi;
  for (const match of $("#gnd").html()?.matchAll(newerPattern) ?? []) {
    try {
      const ref = parseGalleryUrl(new URL(match[1]!, "https://e-hentai.org").toString());
      newerVersions.push({ gid: ref.gid, token: ref.token, title: load(`<span>${match[2]}</span>`).text().trim(), added: match[3]!.trim() });
    } catch { /* Ignore malformed version links while keeping valid ones. */ }
  }
  return {
    description: galleryDescription($),
    gallery: {
      gid, token, title: textValue($, "#gn") ?? "", titleJpn: textValue($, "#gj"), category: textValue($, "#gdc") ?? "",
      uploader: $("#gdn a[href*='/uploader/']").first().text().trim() || null, posted: rows.get("Posted") ?? null, parent,
      visible: rows.get("Visible") ?? null, language: rows.get("Language") ?? null, fileSize: rows.get("File Size") ?? null,
      pages: rows.has("Length") ? numberFromText(rows.get("Length")!) : null, favoriteCount: numberFromText($("#favcount").text()),
      rating: scriptRating || labelRating ? Number(scriptRating ?? labelRating) : null, ratingCount: $("#rating_count").length ? numberFromText($("#rating_count").text()) : null,
      torrentCount: numberFromText($("#gd5").text().match(/Torrent Download\s*\((\d+)\)/i)?.[1] ?? "0"),
    }, tagGroups, newerVersions,
  };
}
