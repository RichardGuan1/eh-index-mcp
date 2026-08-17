import type {
  EhSite,
  GalleryMetadata,
  GalleryWork,
  GalleryWorkOrganization,
  GalleryWorkVariant,
} from "./types.js";
import { extractSimilarGalleryTitle, extractTitleParts } from "./gallery-title.js";

const CREATOR_NAMESPACES = new Set(["group", "artist", "cosplayer"]);
const LANGUAGE_PREFIX = "language:";
const EDITION_SUFFIXES = new Set([
  "digital", "translated", "rewrite", "colorized", "decensored", "uncensored",
  "chinese", "english", "korean", "spanish", "portuguese-br", "russian", "french", "german",
]);

function namespacedValues(tags: string[], namespaces: Set<string>): string[] {
  return tags.filter((tag) => namespaces.has(tag.split(":", 1)[0] ?? "")).sort();
}

function languages(tags: string[]): string[] {
  return tags.filter((tag) => tag.startsWith(LANGUAGE_PREFIX))
    .map((tag) => tag.slice(LANGUAGE_PREFIX.length))
    .filter((tag) => tag !== "translated" && tag !== "rewrite")
    .sort();
}

function isEditionLabel(label: string): boolean {
  return EDITION_SUFFIXES.has(label)
    || /^(?:chinese|english|korean|spanish|portuguese|russian|french|german)\b/u.test(label);
}

function stripEditionSuffixes(title: string, tags: string[]): string {
  let normalized = title.normalize("NFKC").trim();
  const suffixes: Array<{ index: number; label: string }> = [];
  let cursor = normalized.length;
  for (;;) {
    const match = normalized.slice(0, cursor).match(/\s*\[([^\]]+)\]\s*$/u);
    if (!match || match.index === undefined) break;
    suffixes.unshift({ index: match.index, label: match[1]!.trim().toLowerCase() });
    cursor = match.index;
  }
  const translated = tags.includes("language:translated") || tags.includes("language:rewrite");
  if (suffixes.length > 0 && (suffixes.every((suffix) => isEditionLabel(suffix.label))
    || (translated && suffixes.some((suffix) => isEditionLabel(suffix.label))))) {
    normalized = normalized.slice(0, suffixes[0]!.index).trim();
  }
  return normalized;
}

function stripParodyQualifier(title: string, tags: string[]): string {
  const match = title.match(/\s*\(([^()]+)\)\s*$/u);
  if (!match) return title;
  const parodies = tags
    .filter((tag) => tag.startsWith("parody:"))
    .map((tag) => normalizedKey(tag.slice("parody:".length)));
  return parodies.includes(normalizedKey(match[1]!)) ? title.slice(0, match.index).trim() : title;
}

function workIdentity(title: string, tags: string[]): { baseTitle: string; installment: string | null } {
  const identityTitle = title.split("|", 1)[0]!;
  const stripped = stripParodyQualifier(stripEditionSuffixes(identityTitle, tags).trim(), tags);
  const withoutCreator = stripped
    .replace(/^\s*(?:\([^()]+\)\s*)?\[[^\]]+\]\s*/u, "")
    .trim();
  const suffix = extractTitleParts(title).suffix;
  const installment = suffix.match(/\d+(?:\.\d+)?(?:\s*\+\s*\d+(?:\.\d+)?)?/u)?.[0]?.replace(/\s+/gu, "") ?? null;
  return { baseTitle: withoutCreator, installment };
}

function normalizedKey(value: string): string {
  return value.normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, " ")
    .replace(/(?<=\p{L})\s+(?=\p{N})|(?<=\p{N})\s+(?=\p{L})/gu, "")
    .trim();
}

function creatorAliases(creators: string[]): string[] {
  return [...new Set(creators.map((creator) => normalizedKey(creator.slice(creator.indexOf(":") + 1))))].sort();
}

function sharesCreator(left: string[], right: string[]): boolean {
  const rightSet = new Set(right);
  return left.some((creator) => rightSet.has(creator));
}

function mergeCreators(left: string[], right: string[]): string[] {
  return [...new Set([...left, ...right])].sort();
}

function seriesTitle(baseTitle: string): string {
  return extractSimilarGalleryTitle(baseTitle) ?? baseTitle.trim();
}

function toVariant(metadata: GalleryMetadata, site: EhSite): GalleryWorkVariant {
  const host = site === "exhentai" ? "exhentai.org" : "e-hentai.org";
  const tags = metadata.tags ?? [];
  return {
    gid: Number(metadata.gid),
    token: metadata.token!,
    url: `https://${host}/g/${metadata.gid}/${metadata.token}/`,
    title: metadata.title ?? metadata.title_jpn ?? `Gallery ${metadata.gid}`,
    titleJpn: metadata.title_jpn ?? null,
    category: metadata.category ?? null,
    posted: metadata.posted ?? null,
    pages: Number.isFinite(Number(metadata.filecount)) ? Number(metadata.filecount) : null,
    rating: Number.isFinite(Number(metadata.rating)) ? Number(metadata.rating) : null,
    languages: languages(tags),
  };
}

function preferredVariant(variants: GalleryWorkVariant[], preferredGid: number | null): GalleryWorkVariant {
  return [...variants].sort((left, right) => {
    const leftCurrent = left.gid === preferredGid ? 1 : 0;
    const rightCurrent = right.gid === preferredGid ? 1 : 0;
    const leftOriginal = left.languages.length === 0 ? 1 : 0;
    const rightOriginal = right.languages.length === 0 ? 1 : 0;
    return rightCurrent - leftCurrent || rightOriginal - leftOriginal || (right.rating ?? -1) - (left.rating ?? -1) || right.gid - left.gid;
  })[0]!;
}

export function organizeGalleryWorks(metadata: GalleryMetadata[], site: EhSite): GalleryWorkOrganization {
  const valid = metadata.filter((entry) => !entry.error && entry.token && (entry.title || entry.title_jpn));
  const officialKeys = new Map<string, { key: string; preferredGid: number }>();
  const refKey = (gid: string | number, token: string) => `${Number(gid)}:${token.toLowerCase()}`;
  for (const entry of valid) {
    const currentGid = Number(entry.current_gid);
    if (!Number.isInteger(currentGid) || currentGid < 1 || !entry.current_key) continue;
    const official = { key: `official:${currentGid}:${entry.current_key.toLowerCase()}`, preferredGid: currentGid };
    officialKeys.set(refKey(entry.gid, entry.token!), official);
    officialKeys.set(refKey(currentGid, entry.current_key), official);
  }

  const workGroups = new Map<string, { identity: ReturnType<typeof workIdentity>; creators: string[]; creatorAliases: string[]; preferredGid: number | null; variants: GalleryWorkVariant[] }>();

  for (const entry of valid) {
    const title = entry.title ?? entry.title_jpn!;
    const tags = entry.tags ?? [];
    const identity = workIdentity(title, tags);
    const creators = namespacedValues(tags, CREATOR_NAMESPACES);
    const aliases = creatorAliases(creators);
    const official = officialKeys.get(refKey(entry.gid, entry.token!));
    const titleKey = normalizedKey(identity.baseTitle);
    const related = official ? null : [...workGroups.entries()].find(([, candidate]) =>
      normalizedKey(candidate.identity.baseTitle) === titleKey
      && aliases.length > 0
      && sharesCreator(candidate.creatorAliases, aliases));
    const key = official?.key ?? related?.[0] ?? `${creators.join("|") || `gid:${entry.gid}`}::${titleKey}`;
    const group = workGroups.get(key) ?? { identity, creators, creatorAliases: aliases, preferredGid: official?.preferredGid ?? null, variants: [] };
    group.creators = mergeCreators(group.creators, creators);
    group.creatorAliases = mergeCreators(group.creatorAliases, aliases);
    if (official && Number(entry.gid) === official.preferredGid) {
      group.identity = identity;
    }
    group.variants.push(toVariant(entry, site));
    workGroups.set(key, group);
  }

  const seriesGroups = new Map<string, { title: string; creators: string[]; creatorAliases: string[]; works: GalleryWork[] }>();
  for (const [key, group] of workGroups) {
    const availableLanguages = [...new Set(group.variants.flatMap((variant) => variant.languages))].sort();
    const work: GalleryWork = {
      key,
      title: group.identity.baseTitle,
      installment: group.identity.installment,
      creators: group.creators,
      availableLanguages,
      groupingConfidence: group.creators.length > 0 ? "high" : group.variants.length > 1 ? "medium" : "low",
      preferredGallery: preferredVariant(group.variants, group.preferredGid),
      variants: group.variants.sort((left, right) => right.gid - left.gid),
    };
    const title = seriesTitle(group.identity.baseTitle);
    const titleKey = normalizedKey(title);
    const related = [...seriesGroups.entries()].find(([, candidate]) =>
      normalizedKey(candidate.title) === titleKey
      && group.creatorAliases.length > 0
      && sharesCreator(candidate.creatorAliases, group.creatorAliases));
    const seriesKey = related?.[0] ?? `${group.creators.join("|") || key}::${titleKey}`;
    const series = seriesGroups.get(seriesKey) ?? { title, creators: group.creators, creatorAliases: group.creatorAliases, works: [] };
    series.creators = mergeCreators(series.creators, group.creators);
    series.creatorAliases = mergeCreators(series.creatorAliases, group.creatorAliases);
    series.works.push(work);
    seriesGroups.set(seriesKey, series);
  }

  const series = [...seriesGroups.entries()].map(([key, group]) => ({
    key,
    title: group.title,
    creators: group.creators,
    works: group.works.sort((left, right) => (left.installment ?? left.title).localeCompare(right.installment ?? right.title, undefined, { numeric: true })),
  })).sort((left, right) => right.works.length - left.works.length || left.title.localeCompare(right.title));

  return { galleryCount: valid.length, uniqueWorkCount: workGroups.size, seriesCount: series.length, series };
}
