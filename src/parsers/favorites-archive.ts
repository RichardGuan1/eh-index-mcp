import { load } from "cheerio";
import type { ArchiveOptionsResult, EhSite, FavoriteDetailResult, FavoriteCategoriesResult, GalleryRef } from "../types.js";
import { parseGalleryUrl } from "../urls.js";
import { assertNotChallengePage, isNotNull, numberFromText } from "./shared.js";

export function parseArchiveOptions(html: string, site: EhSite = "e-hentai"): ArchiveOptionsResult {
  assertNotChallengePage(html, site);
  const $ = load(html);
  const bodyText = $("body").text().replace(/\s+/g, " ");
  const balanceMatch = bodyText.match(/(?:GP Balance|Available Funds|Current Funds):\s*([\d,]+\s*(?:GP|Credits?))/i);
  const legacyOptions = $("input[type='radio'][name='dltype']").map((_, input) => {
    const row = $(input).closest("tr"); const text = row.find("td").map((__, cell) => $(cell).text().trim()).get().join(" ").replace(/\s+/g, " ").trim(); const value = $(input).attr("value") ?? "";
    const kind = /hath|h@h/i.test(`${value} ${text}`) ? "hath" as const : /res/i.test(`${value} ${text}`) ? "resample" as const : "original" as const;
    const resolution = kind === "original" || /\boriginal\b/i.test(`${value} ${text}`) ? "original" : text.match(/\b\d{3,4}\s*x\b/i)?.[0]?.replace(/\s+/g, "") ?? "resampled";
    const size = text.match(/[\d,.]+\s*(?:KiB|MiB|GiB)/i)?.[0] ?? ""; const cost = text.match(/[\d,]+\s*(?:GP|Credits?)|\bFree\b/i)?.[0] ?? "";
    return { kind, resolution, size, cost };
  }).get();
  const archiveOptions = $("form:has(input[type='hidden'][name='dltype'])").map((_, form) => {
    const node = $(form); const value = node.find("input[type='hidden'][name='dltype']").attr("value") ?? ""; const kind = /^org/i.test(value) ? "original" as const : /^res/i.test(value) ? "resample" as const : null;
    if (!kind) return null; const text = node.parent().text().replace(/\s+/g, " ").trim(); const size = text.match(/[\d,.]+\s*(?:KiB|MiB|GiB)/i)?.[0]; const cost = text.match(/[\d,]+\s*(?:GP|Credits?)|\bFree\b/i)?.[0];
    if (!size || !cost) return null; return { kind, resolution: kind === "original" ? "original" : "resampled", size, cost };
  }).get().filter(isNotNull);
  const hathOptions = $("#hathdl_form").parent().find("table td").map((_, cell) => {
    const text = $(cell).text().replace(/\s+/g, " ").trim(); const size = text.match(/[\d,.]+\s*(?:KiB|MiB|GiB)/i)?.[0]; const cost = text.match(/[\d,]+\s*(?:GP|Credits?)|\bFree\b/i)?.[0];
    const resolution = /\boriginal\b/i.test(text) ? "original" : text.match(/\b\d{3,4}\s*x\b/i)?.[0]?.replace(/\s+/g, "");
    if (!size || !cost || !resolution) return null; return { kind: "hath" as const, resolution, size, cost };
  }).get().filter(isNotNull);
  const options = [...legacyOptions, ...archiveOptions, ...hathOptions];
  if (options.length === 0) throw new Error("E-Hentai archive page returned no available options");
  return { balance: balanceMatch?.[1] ?? null, options };
}

export function parseFavoriteDetail(popupHtml: string, listHtml: string, ref: GalleryRef, site: EhSite = "e-hentai"): FavoriteDetailResult {
  assertNotChallengePage(popupHtml, site); assertNotChallengePage(listHtml, site); const popup = load(popupHtml); const list = load(listHtml);
  const rowLink = list("a[href*='/g/']").filter((_, link) => { const href = list(link).attr("href"); if (!href) return false; try { const candidate = parseGalleryUrl(new URL(href, "https://e-hentai.org").toString()); return candidate.gid === ref.gid && candidate.token === ref.token.toLowerCase(); } catch { return false; } }).first();
  const row = rowLink.closest("tr, .gl1t"); const popupHasRemoveAction = popup("input[name='favdel'], input[value*='Remove'], input[value*='Delete'], [onclick*='favdel']").length > 0; const favorited = rowLink.length > 0 || popupHasRemoveAction;
  const checked = popup("input[name='favcat']:checked").first(); const value = checked.attr("value"); const labelName = popup(`label[for='${checked.attr("id")}']`).first().text().trim(); const panelName = checked.parent().parent().children("div").eq(2).text().trim();
  const category = favorited && value && /^\d$/.test(value) ? { index: Number(value), name: labelName || panelName || `Favorites ${value}` } : null;
  const favoritedAt = row.find(".glfav").first().text().trim() || null; const listNote = row.find(`#favnote_${ref.gid}`).first().text().replace(/^Note:\s*/i, "").trim(); const popupNote = popup("textarea[name='favnote']").first().text().trim();
  return { gallery: ref, favorited, category, note: favorited ? (popupNote || listNote) || null : null, favoritedAt };
}

export function parseFavoriteCategories(html: string, site: EhSite = "e-hentai"): FavoriteCategoriesResult {
  assertNotChallengePage(html, site);
  const $ = load(html);
  const panels = $("div.fp[onclick*='favcat=']");
  if (panels.length > 0) {
    const categories = panels.map((_, panel) => {
      const node = $(panel);
      const value = node.attr("onclick")?.match(/[?&]favcat=(\d)(?=['"&]|$)/)?.[1];
      if (!value) return null;
      const children = node.children("div");
      return {
        index: Number(value),
        name: children.eq(2).text().trim(),
        count: numberFromText(children.eq(0).text()),
      };
    }).get().filter((category): category is { index: number; name: string; count: number } => category !== null)
      .sort((left, right) => left.index - right.index);
    const indexes = new Set(categories.map((category) => category.index));
    if (panels.length !== 10 || categories.length !== 10 || indexes.size !== 10 || categories.some((category, index) => category.index !== index || !category.name)) {
      throw new Error(`Expected 10 favorite categories, received ${categories.length}`);
    }
    const selectedPanels = panels.filter(".fps");
    if (selectedPanels.length > 1) throw new Error("E-Hentai favorites page returned multiple selected favorite categories");
    const selectedMatch = selectedPanels.first().attr("onclick")?.match(/[?&]favcat=(\d)(?=['"&]|$)/)?.[1];
    if (selectedPanels.length === 1 && !selectedMatch) throw new Error("E-Hentai favorites page returned an invalid selected favorite category");
    return {
      total: categories.reduce((sum, category) => sum + category.count, 0),
      selected: selectedPanels.length === 0 ? "all" : Number(selectedMatch),
      categories,
    };
  }

  const links = $("a[href*='favorites.php?favcat=']");
  const categories = links.map((_, link) => {
    const node = $(link);
    const value = new URL(node.attr("href")!, "https://e-hentai.org").searchParams.get("favcat");
    if (!value || !/^\d$/.test(value)) return null;
    return {
      index: Number(value),
      name: node.text().trim(),
      count: numberFromText(node.parent().find("span").first().text()),
    };
  }).get().filter((category): category is { index: number; name: string; count: number } => category !== null)
    .sort((left, right) => left.index - right.index);
  if (categories.length !== 10) throw new Error(`Expected 10 favorite categories, received ${categories.length}`);
  const allLink = links.filter((_, link) => new URL($(link).attr("href")!, "https://e-hentai.org").searchParams.get("favcat") === "all").first();
  const allCount = allLink.parent().find("span").first().text().trim();
  if (!allLink.length || !allCount) throw new Error("E-Hentai favorites page returned no all-favorites total");
  const selectedLink = links.filter((_, link) => !$(link).parent().hasClass("nosel")).first();
  const selectedHref = selectedLink.attr("href");
  if (!selectedHref) throw new Error("E-Hentai favorites page returned no selected favorite category");
  const selectedValue = new URL(selectedHref, "https://e-hentai.org").searchParams.get("favcat");
  if (selectedValue !== "all" && !/^\d$/.test(selectedValue ?? "")) {
    throw new Error("E-Hentai favorites page returned an invalid selected favorite category");
  }
  return {
    total: numberFromText(allCount),
    selected: selectedValue === "all" ? "all" : Number(selectedValue),
    categories,
  };
}
