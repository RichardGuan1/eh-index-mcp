import { load, type CheerioAPI } from "cheerio";
import type {
  ArchiveOptionsResult,
  EhSite,
  FavoriteCategoriesResult,
  FavoriteDetailResult,
  GalleryDetailResult,
  GalleryComment,
  GalleryListResult,
  GalleryNewerVersion,
  GalleryPagesResult,
  GalleryRef,
  GallerySummary,
  GalleryTagGroup,
  GalleryTorrent,
  ImagePageResult,
  TagDefinitionResult,
} from "./types.js";
import { parseGalleryUrl, parsePageUrl } from "./urls.js";

export function assertNotChallengePage(html: string): void {
  if (/Just a moment|challenge-platform|cf-chl-|cf_chl_/i.test(html)) {
    throw new Error("E-Hentai returned a Cloudflare challenge page; refresh the browser session or EH_CF_CLEARANCE cookie");
  }
  const banMatch = html.match(/Your IP address has been temporarily banned for excessive pageloads[\s\S]*?The ban expires in\s+([^<\r\n]+)/i);
  if (banMatch) {
    throw new Error(`E-Hentai IP temporarily banned for ${banMatch[1]!.trim()}; stop requests until the ban expires`);
  }
}

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

function numberFromText(value: string, fallback = 0): number {
  const number = Number.parseInt(value.replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(number) ? number : fallback;
}

function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

function textValue($: CheerioAPI, selector: string): string | null {
  const value = $(selector).first().text().replace(/\u00a0/g, " ").trim();
  return value || null;
}

function detailRows($: CheerioAPI): Map<string, string> {
  const rows = new Map<string, string>();
  $("#gdd tr").each((_, row) => {
    const key = $(row).find(".gdt1").first().text().trim().replace(/:$/, "");
    const value = $(row).find(".gdt2").first().text().replace(/\u00a0/g, " ").trim();
    if (key) rows.set(key, value);
  });
  return rows;
}

function galleryDescription($: CheerioAPI): GalleryDetailResult["description"] {
  const node = $("#gld").first().clone();
  if (!node.length) return null;
  node.find("script, style, noscript").remove();
  node.find("br").replaceWith("\n");
  const text = node.text()
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text ? { text, untrusted: true } : null;
}

function parseGalleryRow($: CheerioAPI, element: unknown, site: EhSite): GallerySummary | null {
  const row = $(element as never);
  const href = row.find(".glname a[href*='/g/'], a[href*='/g/']").first().attr("href");
  if (!href) return null;
  const baseUrl = site === "exhentai" ? "https://exhentai.org" : "https://e-hentai.org";

  let ref;
  try {
    ref = parseGalleryUrl(new URL(href, baseUrl).toString());
  } catch {
    return null;
  }

  const pagesMatch = row.find(".glhide, .gl2m, .gl2c, .gl4c, .gl3e, .gl5t").text().match(/(\d+)\s+pages?/i);
  const thumbnail = row.find(".glthumb [data-src], .glthumb img[src], .gl1e img[data-src], .gl1e img[src], .gl3t img[data-src], .gl3t img[src]").first();
  const thumbnailUrl = thumbnail.attr("data-src") ?? thumbnail.attr("src") ?? null;
  const title = row.find(".glink").first().text().trim();
  if (!title) return null;

  return {
    ...ref,
    url: new URL(href, baseUrl).toString(),
    title,
    category: row.find(".cn, .cs").first().text().trim(),
    uploader: row.find("a[href*='/uploader/']").first().text().trim() || null,
    posted: row.find(`[id='posted_${ref.gid}']`).first().text().trim() || null,
    pages: pagesMatch ? Number(pagesMatch[1]) : null,
    rating: parseRating($, element),
    tags: row.find(".gt[title], .gtl[title]").map((_, tag) => $(tag).attr("title") ?? "").get().filter(Boolean),
    thumbnailUrl,
  };
}

export function parseGalleryList(html: string, site: EhSite = "e-hentai"): GalleryListResult {
  assertNotChallengePage(html);
  const $ = load(html);
  const warning = $(".searchwarn").first().text().trim();
  if (warning) throw new Error(`E-Hentai search error: ${warning}`);

  const galleries = $(".itg > tbody > tr, .itg > tr, .itg .gl1t")
    .map((_, row) => parseGalleryRow($, row, site))
    .get()
    .filter((gallery): gallery is GallerySummary => gallery !== null);

  return {
    galleries,
    prev: cursorFromHref($("#uprev").attr("href"), "prev"),
    next: cursorFromHref($("#unext").attr("href"), "next"),
  };
}

export function parseFavoriteCategories(html: string): FavoriteCategoriesResult {
  assertNotChallengePage(html);
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

export function parseTagDefinition(html: string, sourceUrl: string): TagDefinitionResult {
  assertNotChallengePage(html);
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

export function parseArchiveOptions(html: string): ArchiveOptionsResult {
  assertNotChallengePage(html);
  const $ = load(html);
  const bodyText = $("body").text().replace(/\s+/g, " ");
  const balanceMatch = bodyText.match(/(?:GP Balance|Available Funds|Current Funds):\s*([\d,]+\s*(?:GP|Credits?))/i);
  const legacyOptions = $("input[type='radio'][name='dltype']").map((_, input) => {
    const row = $(input).closest("tr");
    const text = row.find("td").map((__, cell) => $(cell).text().trim()).get().join(" ").replace(/\s+/g, " ").trim();
    const value = $(input).attr("value") ?? "";
    const kind = /hath|h@h/i.test(`${value} ${text}`) ? "hath" as const
      : /res/i.test(`${value} ${text}`) ? "resample" as const
        : "original" as const;
    const resolution = kind === "original" || /\boriginal\b/i.test(`${value} ${text}`)
      ? "original"
      : text.match(/\b\d{3,4}\s*x\b/i)?.[0]?.replace(/\s+/g, "") ?? "resampled";
    const size = text.match(/[\d,.]+\s*(?:KiB|MiB|GiB)/i)?.[0] ?? "";
    const cost = text.match(/[\d,]+\s*(?:GP|Credits?)|\bFree\b/i)?.[0] ?? "";
    return { kind, resolution, size, cost };
  }).get();

  const archiveOptions = $("form:has(input[type='hidden'][name='dltype'])").map((_, form) => {
    const node = $(form);
    const value = node.find("input[type='hidden'][name='dltype']").attr("value") ?? "";
    const kind = /^org/i.test(value) ? "original" as const : /^res/i.test(value) ? "resample" as const : null;
    if (!kind) return null;
    const text = node.parent().text().replace(/\s+/g, " ").trim();
    const size = text.match(/[\d,.]+\s*(?:KiB|MiB|GiB)/i)?.[0];
    const cost = text.match(/[\d,]+\s*(?:GP|Credits?)|\bFree\b/i)?.[0];
    if (!size || !cost) return null;
    return { kind, resolution: kind === "original" ? "original" : "resampled", size, cost };
  }).get().filter(isNotNull);

  const hathOptions = $("#hathdl_form").parent().find("table td").map((_, cell) => {
    const text = $(cell).text().replace(/\s+/g, " ").trim();
    const size = text.match(/[\d,.]+\s*(?:KiB|MiB|GiB)/i)?.[0];
    const cost = text.match(/[\d,]+\s*(?:GP|Credits?)|\bFree\b/i)?.[0];
    const resolution = /\boriginal\b/i.test(text)
      ? "original"
      : text.match(/\b\d{3,4}\s*x\b/i)?.[0]?.replace(/\s+/g, "");
    if (!size || !cost || !resolution) return null;
    return { kind: "hath" as const, resolution, size, cost };
  }).get().filter(isNotNull);

  const options = [...legacyOptions, ...archiveOptions, ...hathOptions];
  if (options.length === 0) throw new Error("E-Hentai archive page returned no available options");
  return { balance: balanceMatch?.[1] ?? null, options };
}

export function parseFavoriteDetail(popupHtml: string, listHtml: string, ref: GalleryRef): FavoriteDetailResult {
  assertNotChallengePage(popupHtml);
  assertNotChallengePage(listHtml);
  const popup = load(popupHtml);
  const list = load(listHtml);
  const rowLink = list("a[href*='/g/']").filter((_, link) => {
    const href = list(link).attr("href");
    if (!href) return false;
    try {
      const candidate = parseGalleryUrl(new URL(href, "https://e-hentai.org").toString());
      return candidate.gid === ref.gid && candidate.token === ref.token.toLowerCase();
    } catch {
      return false;
    }
  }).first();
  const row = rowLink.closest("tr, .gl1t");
  const popupHasRemoveAction = popup("input[name='favdel'], input[value*='Remove'], input[value*='Delete'], [onclick*='favdel']").length > 0;
  const favorited = rowLink.length > 0 || popupHasRemoveAction;
  const checked = popup("input[name='favcat']:checked").first();
  const value = checked.attr("value");
  const labelName = popup(`label[for='${checked.attr("id")}']`).first().text().trim();
  const panelName = checked.parent().parent().children("div").eq(2).text().trim();
  const category = favorited && value && /^\d$/.test(value) ? {
    index: Number(value),
    name: labelName || panelName || `Favorites ${value}`,
  } : null;
  const favoritedAt = row.find(".glfav").first().text().trim() || null;
  const listNote = row.find(`#favnote_${ref.gid}`).first().text().replace(/^Note:\s*/i, "").trim();
  const popupNote = popup("textarea[name='favnote']").first().text().trim();
  return {
    gallery: ref,
    favorited,
    category,
    note: favorited ? (popupNote || listNote) || null : null,
    favoritedAt,
  };
}

export function parseGalleryDetail(html: string, expectedRef?: GalleryRef): GalleryDetailResult {
  assertNotChallengePage(html);
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
    const tags = $(row).find("td").eq(1).find(".gt, .gtl, .gtw").map((__, tag) => ({
      name: $(tag).find("a").first().text().trim(),
      strength: $(tag).hasClass("gtw") ? "weak" as const : $(tag).hasClass("gtl") ? "active" as const : "solid" as const,
    })).get().filter((tag) => tag.name);
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
      gid,
      token,
      title: textValue($, "#gn") ?? "",
      titleJpn: textValue($, "#gj"),
      category: textValue($, "#gdc") ?? "",
      uploader: $("#gdn a[href*='/uploader/']").first().text().trim() || null,
      posted: rows.get("Posted") ?? null,
      parent,
      visible: rows.get("Visible") ?? null,
      language: rows.get("Language") ?? null,
      fileSize: rows.get("File Size") ?? null,
      pages: rows.has("Length") ? numberFromText(rows.get("Length")!) : null,
      favoriteCount: numberFromText($("#favcount").text()),
      rating: scriptRating || labelRating ? Number(scriptRating ?? labelRating) : null,
      ratingCount: $("#rating_count").length ? numberFromText($("#rating_count").text()) : null,
      torrentCount: numberFromText($("#gd5").text().match(/Torrent Download\s*\((\d+)\)/i)?.[1] ?? "0"),
    },
    tagGroups,
    newerVersions,
  };
}

export function parseGalleryComments(html: string): GalleryComment[] {
  assertNotChallengePage(html);
  const $ = load(html);
  return $("#cdiv .c1").map((_, comment) => {
    const node = $(comment);
    const body = node.find(".c6[id^='comment_']").first();
    const id = Number(body.attr("id")?.replace("comment_", ""));
    if (!Number.isInteger(id) || id < 0) return null;
    const header = node.find(".c3").first();
    const headerText = header.text().replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    const posted = headerText.match(/^Posted on\s+(.+?)\s+by:/i)?.[1]?.trim() ?? null;
    const author = header.find("a[href*='/uploader/']").first().text().trim() || null;
    const scoreText = node.find(`#comment_score_${id}`).first().text().trim();
    const score = scoreText ? Number.parseInt(scoreText, 10) : null;
    body.find("br").replaceWith("\n");
    const text = body.text().replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    const votes = node.find(`#cvotes_${id}`).first().text().replace(/\s+/g, " ").trim() || null;
    return {
      id,
      author,
      posted,
      score: Number.isFinite(score) ? score : null,
      uploaderComment: id === 0 || node.find(".c4").text().includes("Uploader Comment"),
      text,
      votes,
      untrusted: true as const,
    };
  }).get().filter((comment): comment is GalleryComment => comment !== null);
}

export function parseTorrents(html: string): GalleryTorrent[] {
  assertNotChallengePage(html);
  const $ = load(html);
  return $("#torrentinfo form").map((index, form) => {
    const formNode = $(form);
    const id = numberFromText(formNode.find("input[name='gtid']").first().attr("value") ?? "", -1);
    const link = formNode.find("a[href$='.torrent']").first();
    const field = (label: string): string => {
      const cell = formNode.find("td").filter((_, node) => $(node).find("span").first().text().trim() === `${label}:`).first();
      return cell.text().replace(new RegExp(`^${label}:\\s*`, "i"), "").trim();
    };
    const uploaderCell = formNode.find("td").filter((_, cell) => $(cell).find("span").first().text().trim() === "Uploader:").first();
    const outdated = formNode.prevAll("p").first().text().toLowerCase().includes("outdated");
    return {
      id,
      name: link.text().trim(),
      url: link.attr("href") ?? "",
      posted: field("Posted"),
      size: field("Size"),
      seeds: numberFromText(field("Seeds")),
      peers: numberFromText(field("Peers")),
      downloads: numberFromText(field("Downloads")),
      uploader: uploaderCell.text().replace(/^Uploader:\s*/i, "").trim() || null,
      outdated,
    };
  }).get().filter((torrent) => torrent.id >= 0 && torrent.url);
}

function absoluteUrl(value: string | undefined, site: EhSite): string | null {
  if (!value) return null;
  const baseUrl = site === "exhentai" ? "https://exhentai.org" : "https://e-hentai.org";
  return new URL(value, baseUrl).toString();
}

export function parseImagePage(html: string, site: EhSite = "e-hentai"): ImagePageResult {
  assertNotChallengePage(html);
  if (/You have (?:exceeded|reached) (?:your |the )?image viewing limits|image limit has been reached/i.test(html)
    || /image limit[\s\S]*(?:insufficient GP|do not have sufficient GP|requires GP|do not have enough)/i.test(html)) {
    throw new Error("E-Hentai image quota exhausted; stop image requests and wait for quota recovery");
  }
  const $ = load(html);
  const imageUrl = $("#img").attr("src") ?? $("#i3 img").attr("src");
  if (!imageUrl) throw new Error("Could not find an image URL on the E-Hentai page");
  const resolvedImageUrl = absoluteUrl(imageUrl, site)!;
  if (/\/(?:g|img)\/509s?\.gif$/i.test(new URL(resolvedImageUrl).pathname)) {
    throw new Error("E-Hentai image quota exhausted; stop image requests and wait for quota recovery");
  }

  const previousPageUrl = absoluteUrl($("a#prev[href*='/s/']").first().attr("href"), site);
  const nextPageUrl = absoluteUrl($("a#next[href*='/s/']").first().attr("href"), site);

  const showKey = /var\s+showkey\s*=\s*["']([0-9a-z]+)["']/i.exec(html)?.[1] ?? null;
  const skipHathKey = /onclick=["'][^"']*\bnl\(['"]([^'"]+)['"]\)/i.exec(html)?.[1] ?? null;
  const originalImageLink = $("a[href*='/fullimg/'], a[href*='fullimg.php']").first().attr("href");

  return {
    imageUrl: absoluteUrl(imageUrl, site)!,
    originalImageUrl: absoluteUrl(originalImageLink, site),
    showKey,
    skipHathKey,
    nextPageUrl,
    previousPageUrl,
  };
}

export function parseGalleryPages(html: string, site: EhSite = "e-hentai"): GalleryPagesResult {
  assertNotChallengePage(html);
  const $ = load(html);
  const totalMatch = $("#gdd").text().match(/Length:\s*(\d+)\s+pages?/i);
  if (!totalMatch) throw new Error("Could not determine the gallery page count");

  const pages = $("#gdt a[href*='/s/']").map((_, anchor) => {
    const baseUrl = site === "exhentai" ? "https://exhentai.org" : "https://e-hentai.org";
    const href = new URL($(anchor).attr("href")!, baseUrl).toString();
    const ref = parsePageUrl(href);
    const child = $(anchor).find("div").first();
    const style = child.attr("style") ?? "";
    const image = $(anchor).find("img").first();
    const background = /url\((?:["']?)(https?:\/\/[^)'"\s]+)(?:["']?)\)/i.exec(style);
    const offset = /\)\s+-(\d+)px\s+/i.exec(style);
    return {
      page: ref.page,
      pageToken: ref.pageToken,
      url: href,
      thumbnailUrl: image.attr("src") ?? image.attr("data-src") ?? background?.[1] ?? null,
      thumbnailOffsetX: offset ? Number(offset[1]) : null,
    };
  }).get();

  return { totalPages: Number(totalMatch[1]), pages };
}
