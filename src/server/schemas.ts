import * as z from "zod/v4";

export const siteSchema = z.enum(["e-hentai", "exhentai"]);
export const siteInput = siteSchema.default("e-hentai").describe("Target site; gallery URLs override this when a URL is provided");
export const gallerySchema = z.object({
  gid: z.number().int().positive().describe("Gallery ID"),
  token: z.string().regex(/^[0-9a-f]{10}$/i).describe("10-character gallery token"),
});
export const pageSchema = z.object({
  gid: z.number().int().positive().describe("Gallery ID"),
  pageToken: z.string().regex(/^[0-9a-f]{10}$/i).describe("10-character image-page token"),
  page: z.number().int().positive().describe("One-based page number"),
});

export const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

export const accessOutputSchema = z.object({ result: z.object({
  site: siteSchema,
  credentialsProvided: z.boolean(),
  authenticated: z.boolean().nullable(),
  reachable: z.boolean().nullable(),
  cloudflareChallenge: z.boolean(),
  status: z.number().int().nullable(),
  message: z.string(),
}) });

export const gallerySummarySchema = gallerySchema.extend({
  site: siteSchema,
  url: z.string().url(),
  title: z.string(),
  category: z.string(),
  uploader: z.string().nullable(),
  posted: z.string().nullable(),
  pages: z.number().int().nullable(),
  rating: z.number().nullable(),
  tags: z.array(z.string()),
  thumbnailUrl: z.string().url().nullable(),
});
export const galleryListSchema = z.object({
  galleries: z.array(gallerySummarySchema),
  prev: z.string().nullable(),
  next: z.string().nullable(),
});
export const galleryListOutputSchema = z.object({ result: galleryListSchema });
export const galleryBatchSearchOutputSchema = z.object({ result: z.object({
  galleries: z.array(gallerySummarySchema),
  inputCount: z.number().int().nonnegative(),
  pagesScanned: z.number().int().positive(),
  resultCount: z.number().int().nonnegative(),
  errorCount: z.literal(0),
  preservedOrder: z.literal(true),
  truncated: z.boolean(),
  next: z.string().nullable(),
}) });
export const fileSearchOutputSchema = z.object({ result: z.object({ path: z.string(), size: z.number().int().nonnegative(), sha1: z.string().regex(/^[0-9a-f]{40}$/), result: galleryListSchema }) });
export const queryOutputSchema = z.object({ result: z.object({ query: z.string(), length: z.number().int().nonnegative(), warnings: z.array(z.string()) }) });
export const capabilitiesOutputSchema = z.object({ result: z.object({
  operators: z.array(z.string()), namespaces: z.array(z.string()), qualifiers: z.array(z.string()), categories: z.array(z.string()),
  limits: z.object({ maxQueryLength: z.number().int(), maxInclusions: z.number().int(), maxExclusions: z.number().int(), minimumIntervalMs: z.number().int() }),
}) });

export const similarGalleryOutputSchema = z.object({ result: z.object({
  strategy: z.enum(["title", "artist", "uploader"]),
  query: z.string(),
  result: galleryListSchema,
}) });
export const galleryPagesSchema = z.object({
  totalPages: z.number().int().positive(),
  pages: z.array(z.object({
    page: z.number().int().positive(),
    pageToken: z.string(),
    url: z.string().url(),
    thumbnailUrl: z.string().url().nullable(),
    thumbnailOffsetX: z.number().int().nullable(),
  })),
});
export const galleryWorkSearchOutputSchema = z.object({ result: z.object({
  pagesScanned: z.number().int().positive(),
  searchedGalleryCount: z.number().int().nonnegative(),
  galleryCount: z.number().int().nonnegative(),
  uniqueWorkCount: z.number().int().nonnegative(),
  seriesCount: z.number().int().nonnegative(),
  truncated: z.boolean(),
  next: z.string().nullable(),
  series: z.array(z.object({
    key: z.string(), title: z.string(), creators: z.array(z.string()),
    works: z.array(z.object({
      key: z.string(), title: z.string(), installment: z.string().nullable(), creators: z.array(z.string()), availableLanguages: z.array(z.string()),
      groupingConfidence: z.enum(["high", "medium", "low"]), groupingBasis: z.enum(["official-version-chain", "normalized-title-and-creator", "standalone"]), groupingExplanation: z.string(),
      preferredGallery: z.object({ gid: z.number(), token: z.string(), site: siteSchema, url: z.string().url(), title: z.string(), titleJpn: z.string().nullable(), category: z.string().nullable(), posted: z.string().nullable(), pages: z.number().nullable(), rating: z.number().nullable(), languages: z.array(z.string()) }),
      variants: z.array(z.object({ gid: z.number(), token: z.string(), site: siteSchema, url: z.string().url(), title: z.string(), titleJpn: z.string().nullable(), category: z.string().nullable(), posted: z.string().nullable(), pages: z.number().nullable(), rating: z.number().nullable(), languages: z.array(z.string()) })),
    })),
  })),
}) });
export const galleryPagesOutputSchema = z.object({ result: galleryPagesSchema });

export const allPagesOutputSchema = z.object({ result: galleryPagesSchema.extend({ previewPagesFetched: z.number().int().positive() }) });
export const imagePageOutputSchema = z.object({ result: z.object({ imageUrl: z.string().url(), originalImageUrl: z.string().url().nullable(), showKey: z.string().nullable(), skipHathKey: z.string().nullable(), nextPageUrl: z.string().url().nullable(), previousPageUrl: z.string().url().nullable() }) });
export const resolvedGalleryOutputSchema = z.object({ gallery: gallerySchema });
export const resolvedGalleryBatchOutputSchema = z.object({ results: z.array(pageSchema.extend({ token: z.string().regex(/^[0-9a-f]{10}$/i).optional(), error: z.string().optional() })), inputCount: z.number().int(), successCount: z.number().int(), errorCount: z.number().int(), preservedOrder: z.literal(true) });

export const commentsOutputSchema = z.object({ result: z.object({
  comments: z.array(z.object({ id: z.number().int().nonnegative(), author: z.string().nullable(), posted: z.string().nullable(), score: z.number().int().nullable(), uploaderComment: z.boolean(), text: z.string(), votes: z.string().nullable(), untrusted: z.literal(true) })),
  includeHidden: z.boolean(),
}) });
export const detailOutputSchema = z.object({ result: z.object({
  gallery: z.object({ gid: z.number().int(), token: z.string(), title: z.string(), titleJpn: z.string().nullable(), category: z.string(), uploader: z.string().nullable(), posted: z.string().nullable(), parent: gallerySchema.nullable(), visible: z.string().nullable(), language: z.string().nullable(), fileSize: z.string().nullable(), pages: z.number().int().nullable(), favoriteCount: z.number().int(), rating: z.number().nullable(), ratingCount: z.number().int().nullable(), torrentCount: z.number().int() }),
  description: z.object({ text: z.string(), untrusted: z.literal(true) }).nullable(), tagGroups: z.array(z.object({ namespace: z.string(), tags: z.array(z.object({ name: z.string(), strength: z.enum(["solid", "weak", "active"]) })) })), newerVersions: z.array(gallerySchema.extend({ title: z.string(), added: z.string() })),
}) });
export const metadataSingleOutputSchema = z.object({ galleries: z.array(z.object({ gid: z.number(), token: z.string().optional(), error: z.string().optional() }).passthrough()) });
export const metadataBatchOutputSchema = z.object({ galleries: z.array(z.object({ gid: z.number(), token: z.string().optional(), error: z.string().optional() }).passthrough()), inputCount: z.number().int(), successCount: z.number().int(), errorCount: z.number().int(), preservedOrder: z.literal(true) });
export const torrentOutputSchema = z.object({ torrents: z.array(z.object({ id: z.number().int(), name: z.string(), url: z.string().url(), posted: z.string(), size: z.string(), seeds: z.number().int(), peers: z.number().int(), downloads: z.number().int(), uploader: z.string().nullable(), outdated: z.boolean() })) });

export const chainOutputSchema = z.object({ galleries: z.array(z.object({ gid: z.number(), token: z.string().optional(), error: z.string().optional() }).passthrough()) });
export const latestOutputSchema = z.object({ gallery: z.object({ gid: z.number(), token: z.string().optional(), error: z.string().optional() }).passthrough() });
export const versionComparisonOutputSchema = z.object({ result: z.object({ before: z.object({ gid: z.number() }).passthrough(), after: z.object({ gid: z.number() }).passthrough(), changes: z.object({ title: z.object({ before: z.string().nullable(), after: z.string().nullable() }), posted: z.object({ before: z.string().nullable(), after: z.string().nullable() }), filecount: z.object({ before: z.number().nullable(), after: z.number().nullable(), delta: z.number().nullable() }), filesize: z.object({ before: z.number().nullable(), after: z.number().nullable(), delta: z.number().nullable() }), tagsAdded: z.array(z.string()), tagsRemoved: z.array(z.string()) }) }) });

export const searchInputShape = {
  site: siteInput,
  query: z.string().max(200).optional().describe("Native E-Hentai query, e.g. language:chinese$ artist:name$"),
  categories: z.array(z.enum(["misc", "doujinshi", "manga", "artist-cg", "game-cg", "western", "non-h", "image-set", "cosplay", "asian-porn"])).max(10).optional().describe("Gallery categories to include; omit to use all categories"),
  minRating: z.number().int().min(2).max(5).optional().describe("Minimum rating from 2 through 5"),
  pageFrom: z.number().int().positive().optional().describe("One-based first result page to scan"),
  pageTo: z.number().int().positive().optional().describe("One-based last result page to scan"),
  hasTorrent: z.boolean().optional().describe("When true, require galleries with torrent metadata"),
  browseExpunged: z.boolean().optional().describe("When true, include expunged galleries where supported"),
  disableLanguageFilter: z.boolean().optional().describe("Disable the site's default language filtering"),
  disableUploaderFilter: z.boolean().optional().describe("Disable the site's default uploader filtering"),
  disableTagFilter: z.boolean().optional().describe("Disable the site's default tag filtering"),
};
