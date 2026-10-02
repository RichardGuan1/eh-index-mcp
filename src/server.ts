import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { EhBackend } from "./server/backend.js";
import type { EhSite, FavoritesOptions, GalleryRef, PageRef, SearchOptions } from "./types.js";
import { parseGalleryPreviewUrl, parseGalleryUrl, parsePageUrl, siteFromUrl } from "./urls.js";
import { buildStructuredSearchQuery, getSearchCapabilities } from "./search-tools.js";
import { VERSION } from "./version.js";
import { registerPrompts } from "./server/prompts.js";
import { success, successValue, toolError } from "./server/helpers.js";
import { siteSchema, siteInput, gallerySchema, pageSchema, annotations, searchInputShape, accessOutputSchema, gallerySummarySchema, galleryListSchema, galleryListOutputSchema, galleryBatchSearchOutputSchema } from "./server/schemas.js";
import { registerSearchTools } from "./server/tools/search.js";
import { registerGalleryTools } from "./server/tools/gallery.js";
import { registerPageTools } from "./server/tools/pages.js";
import { registerAccountTools } from "./server/tools/account.js";
import { registerTagTools } from "./server/tools/tags.js";
import { registerVersionTools } from "./server/tools/versions.js";
import { registerDiagnosticTools } from "./server/tools/diagnostics.js";

const torrentSchema = z.object({
  hash: z.string(),
  added: z.string(),
  name: z.string(),
  tsize: z.string(),
  fsize: z.string(),
});
const galleryMetadataSchema = z.object({
  gid: z.number().int().positive(),
  token: z.string().optional(),
  title: z.string().optional(),
  title_jpn: z.string().optional(),
  category: z.string().optional(),
  thumb: z.string().url().optional(),
  uploader: z.string().optional(),
  posted: z.string().optional(),
  filecount: z.string().optional(),
  filesize: z.number().optional(),
  expunged: z.boolean().optional(),
  rating: z.string().optional(),
  torrentcount: z.string().optional(),
  torrents: z.array(torrentSchema).optional(),
  tags: z.array(z.string()).optional(),
  parent_gid: z.string().optional(),
  parent_key: z.string().optional(),
  current_gid: z.string().optional(),
  current_key: z.string().optional(),
  first_gid: z.string().optional(),
  first_key: z.string().optional(),
  error: z.string().optional(),
});
const galleryPagesSchema = z.object({
  totalPages: z.number().int().positive(),
  pages: z.array(z.object({
    page: z.number().int().positive(),
    pageToken: z.string(),
    url: z.string().url(),
    thumbnailUrl: z.string().url().nullable(),
    thumbnailOffsetX: z.number().int().nullable(),
  })),
});
const imagePageSchema = z.object({
  imageUrl: z.string().url(),
  originalImageUrl: z.string().url().nullable(),
  showKey: z.string().nullable(),
  skipHathKey: z.string().nullable(),
  nextPageUrl: z.string().url().nullable(),
  previousPageUrl: z.string().url().nullable(),
});
const similarGalleryOutputSchema = z.object({ result: z.object({
  strategy: z.enum(["title", "artist", "uploader"]),
  query: z.string(),
  result: galleryListSchema,
}) });
const workVariantSchema = gallerySchema.extend({
  site: siteSchema,
  url: z.string().url(),
  title: z.string(),
  titleJpn: z.string().nullable(),
  category: z.string().nullable(),
  posted: z.string().nullable(),
  pages: z.number().int().nullable(),
  rating: z.number().nullable(),
  languages: z.array(z.string()),
});
const workSchema = z.object({
  key: z.string(),
  title: z.string(),
  installment: z.string().nullable(),
  creators: z.array(z.string()),
  availableLanguages: z.array(z.string()),
  groupingConfidence: z.enum(["high", "medium", "low"]),
  groupingBasis: z.enum(["official-version-chain", "normalized-title-and-creator", "standalone"]),
  groupingExplanation: z.string(),
  preferredGallery: workVariantSchema,
  variants: z.array(workVariantSchema),
});
const galleryWorkSearchOutputSchema = z.object({ result: z.object({
  pagesScanned: z.number().int().positive(),
  searchedGalleryCount: z.number().int().nonnegative(),
  galleryCount: z.number().int().nonnegative(),
  uniqueWorkCount: z.number().int().nonnegative(),
  seriesCount: z.number().int().nonnegative(),
  truncated: z.boolean(),
  next: z.string().nullable(),
  series: z.array(z.object({
    key: z.string(),
    title: z.string(),
    creators: z.array(z.string()),
    works: z.array(workSchema),
  })),
}) });
const batchSummaryShape = {
  inputCount: z.number().int().nonnegative(),
  successCount: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  preservedOrder: z.literal(true),
};
const metadataSingleOutputSchema = z.object({ galleries: z.array(galleryMetadataSchema) });
const metadataBatchOutputSchema = z.object({
  galleries: z.array(galleryMetadataSchema),
  ...batchSummaryShape,
});
const galleryPagesOutputSchema = z.object({ result: galleryPagesSchema });
const imagePageOutputSchema = z.object({ result: imagePageSchema });
const resolvedGalleryOutputSchema = z.object({ gallery: gallerySchema });
const resolvedGalleryBatchOutputSchema = z.object({
  results: z.array(pageSchema.extend({
    token: z.string().regex(/^[0-9a-f]{10}$/i).optional(),
    error: z.string().optional(),
  })),
  ...batchSummaryShape,
});
const favoriteCategoriesOutputSchema = z.object({ result: z.object({
  total: z.number().int().nonnegative(),
  selected: z.union([z.number().int().min(0).max(9), z.literal("all")]),
  categories: z.array(z.object({
    index: z.number().int().min(0).max(9),
    name: z.string(),
    count: z.number().int().nonnegative(),
  })),
}) });
const favoriteDetailOutputSchema = z.object({ result: z.object({
  gallery: gallerySchema,
  favorited: z.boolean(),
  category: z.object({ index: z.number().int().min(0).max(9), name: z.string() }).nullable(),
  note: z.string().nullable(),
  favoritedAt: z.string().nullable(),
}) });
const archiveOptionsOutputSchema = z.object({ result: z.object({
  balance: z.string().nullable(),
  options: z.array(z.object({
    kind: z.enum(["original", "resample", "hath"]),
    resolution: z.string(),
    size: z.string(),
    cost: z.string(),
  })),
}) });
const tagDefinitionOutputSchema = z.object({ result: z.object({
  title: z.string(),
  description: z.string().nullable(),
  tagType: z.string().nullable(),
  slaveTags: z.array(z.string()),
  notes: z.string().nullable(),
  sourceUrl: z.string().url(),
  untrusted: z.literal(true),
}) });
const translatedTagsOutputSchema = z.object({ result: z.object({
  source: z.object({
    repository: z.literal("https://github.com/EhTagTranslation/Database"),
    revision: z.string().regex(/^[0-9a-f]{40}$/i),
    version: z.number().int().positive(),
    license: z.literal("CC BY-NC-SA 3.0 CN"),
  }),
  untrusted: z.literal(true),
  matches: z.array(z.object({
    namespace: z.string(),
    tag: z.string(),
    translatedName: z.string(),
    intro: z.string(),
    searchQuery: z.string(),
    match: z.enum(["name-exact", "tag-exact", "name-contains", "tag-contains"]),
  })),
}) });
const detailOutputSchema = z.object({ result: z.object({
  gallery: z.object({
    gid: z.number().int(), token: z.string(), title: z.string(), titleJpn: z.string().nullable(), category: z.string(), uploader: z.string().nullable(), posted: z.string().nullable(), parent: gallerySchema.nullable(), visible: z.string().nullable(), language: z.string().nullable(), fileSize: z.string().nullable(), pages: z.number().int().nullable(), favoriteCount: z.number().int(), rating: z.number().nullable(), ratingCount: z.number().int().nullable(), torrentCount: z.number().int(),
  }),
  description: z.object({ text: z.string(), untrusted: z.literal(true) }).nullable(),
  tagGroups: z.array(z.object({ namespace: z.string(), tags: z.array(z.object({ name: z.string(), strength: z.enum(["solid", "weak", "active"]) })) })),
  newerVersions: z.array(gallerySchema.extend({ title: z.string(), added: z.string() })),
}) });
const torrentOutputSchema = z.object({ torrents: z.array(z.object({ id: z.number().int(), name: z.string(), url: z.string().url(), posted: z.string(), size: z.string(), seeds: z.number().int(), peers: z.number().int(), downloads: z.number().int(), uploader: z.string().nullable(), outdated: z.boolean() })) });
const chainOutputSchema = z.object({ galleries: z.array(galleryMetadataSchema) });
const fileSearchOutputSchema = z.object({ result: z.object({ path: z.string(), size: z.number().int().nonnegative(), sha1: z.string().regex(/^[0-9a-f]{40}$/), result: galleryListSchema }) });
const allPagesOutputSchema = z.object({ result: galleryPagesSchema.extend({ previewPagesFetched: z.number().int().positive() }) });
const commentsOutputSchema = z.object({ result: z.object({
  comments: z.array(z.object({ id: z.number().int().nonnegative(), author: z.string().nullable(), posted: z.string().nullable(), score: z.number().int().nullable(), uploaderComment: z.boolean(), text: z.string(), votes: z.string().nullable(), untrusted: z.literal(true) })),
  includeHidden: z.boolean(),
}) });
const latestOutputSchema = z.object({ gallery: galleryMetadataSchema });
const versionComparisonOutputSchema = z.object({ result: z.object({
  before: galleryMetadataSchema,
  after: galleryMetadataSchema,
  changes: z.object({
    title: z.object({ before: z.string().nullable(), after: z.string().nullable() }),
    posted: z.object({ before: z.string().nullable(), after: z.string().nullable() }),
    filecount: z.object({ before: z.number().nullable(), after: z.number().nullable(), delta: z.number().nullable() }),
    filesize: z.object({ before: z.number().nullable(), after: z.number().nullable(), delta: z.number().nullable() }),
    tagsAdded: z.array(z.string()),
    tagsRemoved: z.array(z.string()),
  }),
}) });
const queryOutputSchema = z.object({ result: z.object({ query: z.string(), length: z.number().int().nonnegative(), warnings: z.array(z.string()) }) });
const capabilitiesOutputSchema = z.object({ result: z.object({
  operators: z.array(z.string()), namespaces: z.array(z.string()), qualifiers: z.array(z.string()), categories: z.array(z.string()),
  limits: z.object({ maxQueryLength: z.number().int(), maxInclusions: z.number().int(), maxExclusions: z.number().int(), minimumIntervalMs: z.number().int() }),
}) });
export function createServer(backend: EhBackend): McpServer {
  const server = new McpServer({ name: "eh-index-mcp", version: VERSION });

  registerSearchTools(server, backend);

  registerGalleryTools(server, backend);

  registerVersionTools(server, backend);

  registerDiagnosticTools(server, backend);

  registerPageTools(server, backend);

  registerAccountTools(server, backend);
  registerTagTools(server, backend);

  registerPrompts(server);

  return server;
}
