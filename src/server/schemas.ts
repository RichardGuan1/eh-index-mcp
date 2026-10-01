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
