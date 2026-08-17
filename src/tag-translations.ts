import type {
  TagTranslationDatabase,
  TagTranslationMatch,
  TagTranslationSearchResult,
} from "./types.js";

const SOURCE_REPOSITORY = "https://github.com/EhTagTranslation/Database";
const SOURCE_LICENSE = "CC BY-NC-SA 3.0 CN" as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseTagTranslationDatabase(value: unknown): TagTranslationDatabase {
  if (!isRecord(value)
    || value.repo !== SOURCE_REPOSITORY
    || !Number.isInteger(value.version)
    || !isRecord(value.head)
    || typeof value.head.sha !== "string"
    || !/^[0-9a-f]{40}$/i.test(value.head.sha)
    || !Array.isArray(value.data)) {
    throw new Error("EhTagTranslation database schema is incompatible");
  }

  const entries: TagTranslationDatabase["entries"] = [];
  for (const namespaceValue of value.data) {
    if (!isRecord(namespaceValue)
      || typeof namespaceValue.namespace !== "string"
      || !namespaceValue.namespace
      || !isRecord(namespaceValue.data)) {
      throw new Error("EhTagTranslation database schema is incompatible");
    }
    for (const [tag, translationValue] of Object.entries(namespaceValue.data)) {
      if (!tag || !isRecord(translationValue) || typeof translationValue.name !== "string") {
        throw new Error("EhTagTranslation database schema is incompatible");
      }
      entries.push({
        namespace: namespaceValue.namespace,
        tag,
        translatedName: translationValue.name,
        intro: typeof translationValue.intro === "string" ? translationValue.intro.trim() : "",
      });
    }
  }

  return {
    source: {
      repository: SOURCE_REPOSITORY,
      revision: value.head.sha,
      version: value.version as number,
      license: SOURCE_LICENSE,
    },
    entries,
  };
}

function searchQuery(namespace: string, tag: string): string {
  const escaped = tag.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  return `${namespace}:"${escaped}"$`;
}

function toMatch(entry: TagTranslationDatabase["entries"][number], match: TagTranslationMatch["match"]): TagTranslationMatch {
  return {
    namespace: entry.namespace,
    tag: entry.tag,
    translatedName: entry.translatedName,
    intro: entry.intro,
    searchQuery: searchQuery(entry.namespace, entry.tag),
    match,
  };
}

function normalizedLookupKey(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[\p{P}\p{S}\s]+/gu, "");
}

export function searchTranslatedTags(database: TagTranslationDatabase, query: string, limit = 20): TagTranslationSearchResult {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length > 100 || /[\x00-\x1f\x7f]/.test(trimmed)) {
    throw new Error("Translated tag query must contain 1-100 printable characters");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new Error("Translated tag result limit must be an integer from 1 to 50");
  }

  const normalized = normalizedLookupKey(trimmed);
  if (!normalized) throw new Error("Translated tag query must contain letters or numbers");
  const nameExact = database.entries.filter((entry) => normalizedLookupKey(entry.translatedName) === normalized);
  const tagExact = database.entries.filter((entry) => normalizedLookupKey(entry.tag) === normalized);
  const nameContains = database.entries.filter((entry) => normalizedLookupKey(entry.translatedName).includes(normalized));
  const tagContains = database.entries.filter((entry) => normalizedLookupKey(entry.tag).includes(normalized));
  const candidates = nameExact.length > 0
    ? nameExact.map((entry) => toMatch(entry, "name-exact"))
    : tagExact.length > 0
      ? tagExact.map((entry) => toMatch(entry, "tag-exact"))
      : nameContains.length > 0
        ? nameContains.map((entry) => toMatch(entry, "name-contains"))
        : tagContains.map((entry) => toMatch(entry, "tag-contains"));

  return { source: database.source, untrusted: true, matches: candidates.slice(0, limit) };
}
