// Mirrors EhViewer's structural title extraction before its quoted title search.
// Source: EhViewer-NekoInverter/EhViewer, EhUtils.extractTitle (Apache-2.0).
const TITLE_PREFIX = /^(?:(?:\([^)]*\)|\[[^\]]*\]|\{[^}]*\}|~[^~]*~)|\s+)*/u;
const TITLE_SUFFIX = /(?:\s+ch\.[\s\d-]+)?(?:(?:\([^)]*\)|\[[^\]]*\]|\{[^}]*\}|~[^~]*~)|\s+)*$/iu;

export interface ExtractedTitleParts {
  title: string | null;
  suffix: string;
}

export function extractTitleParts(fullTitle: string | null | undefined): ExtractedTitleParts {
  if (fullTitle == null) return { title: null, suffix: "" };

  const withoutPrefix = fullTitle.replace(TITLE_PREFIX, "");
  const suffixMatch = withoutPrefix.match(TITLE_SUFFIX);
  const suffixIndex = suffixMatch?.index ?? withoutPrefix.length;
  const structuralSuffix = withoutPrefix.slice(suffixIndex).trim();
  let title = withoutPrefix.slice(0, suffixIndex);

  const translatedTitleIndex = title.indexOf("|");
  if (translatedTitleIndex >= 0) title = title.slice(0, translatedTitleIndex);

  const normalizedTitle = title.trim();
  return {
    title: normalizedTitle || null,
    suffix: structuralSuffix,
  };
}

export function extractSimilarGalleryTitle(fullTitle: string | null | undefined): string | null {
  return extractTitleParts(fullTitle).title;
}