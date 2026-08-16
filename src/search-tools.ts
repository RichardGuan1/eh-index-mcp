import type { GalleryCategory } from "./types.js";

export interface StructuredSearchInput {
  includeTags?: string[];
  excludeTags?: string[];
  orTags?: string[];
  title?: string;
  exactTags?: boolean;
}

export interface StructuredSearchResult {
  query: string;
  length: number;
  warnings: string[];
}

const CATEGORIES: GalleryCategory[] = [
  "misc", "doujinshi", "manga", "artist-cg", "game-cg",
  "western", "non-h", "image-set", "cosplay", "asian-porn",
];

const NAMESPACES = ["misc", "parody", "character", "group", "artist", "male", "female", "mixed", "other", "reclass", "language", "cosplayer"];
const QUALIFIERS = ["tag", "weak", "title", "uploader", "uploaduid", "gid", "comment", "favnote"];

function quoteValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Search terms cannot be empty");
  if (/["\r\n]/.test(trimmed)) throw new Error("Search terms cannot contain quotes or line breaks");
  return /\s/.test(trimmed) ? `"${trimmed}"` : trimmed;
}

function formatTag(value: string, exact: boolean): string {
  const separator = value.indexOf(":");
  const formatted = separator >= 0
    ? `${value.slice(0, separator).trim()}:${quoteValue(value.slice(separator + 1))}`
    : quoteValue(value);
  return exact ? `${formatted}$` : formatted;
}

export function buildStructuredSearchQuery(input: StructuredSearchInput): StructuredSearchResult {
  const includeTags = input.includeTags ?? [];
  const excludeTags = input.excludeTags ?? [];
  const orTags = input.orTags ?? [];
  if (includeTags.length > 5) throw new Error("Search supports at most 5 inclusion terms");
  if (excludeTags.length > 10) throw new Error("Search supports at most 10 exclusion terms");
  const exact = input.exactTags ?? false;
  const terms = [
    ...includeTags.map((value) => formatTag(value, exact)),
    ...excludeTags.map((value) => `-${formatTag(value, exact)}`),
    ...orTags.map((value) => `~${formatTag(value, exact)}`),
  ];
  if (input.title) terms.push(`title:${quoteValue(input.title)}`);
  const query = terms.join(" ");
  if (query.length > 200) throw new Error("Search query cannot exceed 200 characters");
  return { query, length: query.length, warnings: [] };
}

export function getSearchCapabilities() {
  return {
    operators: ["quotes", "underscore", "wildcard", "exclude", "or", "namespace", "exact"],
    namespaces: NAMESPACES,
    qualifiers: QUALIFIERS,
    categories: CATEGORIES,
    limits: {
      maxQueryLength: 200,
      maxInclusions: 5,
      maxExclusions: 10,
      minimumIntervalMs: 3000,
    },
  };
}
