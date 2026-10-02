import { load } from "cheerio";
import type { EhSite, TagDefinitionResult } from "../types.js";
import { assertNotChallengePage } from "./shared.js";

export function parseTagDefinition(html: string, sourceUrl: string, site: EhSite = "e-hentai"): TagDefinitionResult {
  assertNotChallengePage(html, site);
  const $ = load(html);
  const title = $("#firstHeading").first().text().trim();
  if (!title) throw new Error("EHWiki returned a page without a tag definition title");
  const fields = new Map<string, string>();
  $("#mw-content-text .mw-parser-output li").each((_, item) => {
    const label = $(item).find("b").first().text().trim().replace(/:$/, "");
    if (!label) return;
    const value = $(item).text().replace($(item).find("b").first().text(), "").trim().replace(/^:\s*/, "");
    const key = label.toLowerCase();
    if (!fields.has(key)) fields.set(key, value);
  });
  const slaveTags = (fields.get("slave tags") ?? "").split(/[,;|]/).map((value) => value.trim()).filter(Boolean);
  return {
    title,
    description: fields.get("description") ?? null,
    tagType: fields.get("tag type") ?? null,
    slaveTags,
    notes: fields.get("notes") ?? null,
    sourceUrl,
    untrusted: true,
  };
}
