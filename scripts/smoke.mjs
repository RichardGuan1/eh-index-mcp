import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/client/stdio";
import { writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

const inherited = getDefaultEnvironment();
const proxyEnvironment = Object.fromEntries(
  ["HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "no_proxy"]
    .flatMap((key) => process.env[key] ? [[key, process.env[key]]] : []),
);

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/index.js"],
  cwd: process.cwd(),
  env: { ...inherited, ...proxyEnvironment, NODE_USE_ENV_PROXY: "1" },
  stderr: "pipe",
});
const client = new Client({ name: "eh-index-mcp-smoke", version: "1.0.0" });

function assertResult(result, label) {
  if (result.isError) {
    const message = result.content?.map((item) => item.text ?? "").join("\n") || "unknown error";
    throw new Error(`${label}: ${message}`);
  }
  return result.structuredContent;
}

try {
  await client.connect(transport);
  const tools = await client.listTools();
  if (tools.tools.length !== 26) throw new Error(`Expected 26 tools, received ${tools.tools.length}`);

  const popular = assertResult(await client.callTool({
    name: "eh_get_popular",
    arguments: { site: "e-hentai" },
  }), "popular");
  const candidates = popular.result?.galleries ?? [];
  if (!candidates.length) throw new Error("Popular gallery response was empty");

  const completePagesCandidate = candidates.find((candidate) => candidate.pages && candidate.pages <= 60) ?? null;
  let selected = completePagesCandidate ?? candidates[0];
  let detail;
  for (const candidate of candidates.slice(0, 10)) {
    const candidateDetail = assertResult(await client.callTool({
      name: "eh_get_gallery_detail",
      arguments: { gallery: { gid: candidate.gid, token: candidate.token } },
    }), "gallery detail");
    if (!detail) {
      selected = candidate;
      detail = candidateDetail;
    }
    if (candidateDetail.result?.gallery?.torrentCount > 0) {
      selected = candidate;
      detail = candidateDetail;
      break;
    }
  }
  const gallery = { gid: selected.gid, token: selected.token };

  const capabilities = assertResult(await client.callTool({ name: "eh_get_search_capabilities", arguments: {} }), "search capabilities");
  if (capabilities.result?.limits?.maxQueryLength !== 200) throw new Error("Search capabilities were malformed");
  const query = assertResult(await client.callTool({
    name: "eh_build_search_query",
    arguments: { includeTags: ["language:chinese"], exactTags: true },
  }), "build search query");
  if (query.result?.query !== "language:chinese$") throw new Error("Structured query result was unexpected");

  const translatedTags = assertResult(await client.callTool({
    name: "eh_search_translated_tags",
    arguments: { query: "女男女3P", limit: 5 },
  }), "translated tags");
  const translatedTag = translatedTags.result?.matches?.[0];
  if (
    translatedTags.result?.source?.repository !== "https://github.com/EhTagTranslation/Database"
    || translatedTags.result?.source?.license !== "CC BY-NC-SA 3.0 CN"
    || translatedTags.result?.untrusted !== true
    || translatedTag?.namespace !== "mixed"
    || translatedTag?.tag !== "ffm threesome"
    || translatedTag?.searchQuery !== 'mixed:"ffm threesome"$'
    || translatedTag?.match !== "name-exact"
  ) {
    throw new Error("Translated tag lookup returned unexpected source metadata or tag semantics");
  }

  const translatedTitle = assertResult(await client.callTool({
    name: "eh_search_translated_tags",
    arguments: { query: "千恋万花", limit: 5 },
  }), "translated title without punctuation");
  const translatedTitleMatch = translatedTitle.result?.matches?.[0];
  if (
    translatedTitleMatch?.namespace !== "parody"
    || translatedTitleMatch?.tag !== "senren banka"
    || translatedTitleMatch?.translatedName !== "千恋＊万花"
    || translatedTitleMatch?.match !== "name-exact"
  ) {
    throw new Error("Translated tag lookup did not normalize title punctuation");
  }

  const tagDefinition = assertResult(await client.callTool({
    name: "eh_lookup_tag_definition",
    arguments: { tag: "ai generated" },
  }), "tag definition");
  if (
    tagDefinition.result?.untrusted !== true
    || !tagDefinition.result?.sourceUrl?.startsWith("https://ehwiki.org/wiki/")
    || tagDefinition.result?.tagType !== "Technical / Visual"
    || tagDefinition.result?.description !== "Contains the [AI Generated] indicator within the title."
    || !tagDefinition.result?.notes?.startsWith("May not be directly voted")
  ) {
    throw new Error("Tag definition fields, trust marker, or source metadata were malformed");
  }

  const localFixture = resolve("smoke-local-file.bin");
  await writeFile(localFixture, "eh-index-mcp-smoke");
  let fileSearch;
  try {
    fileSearch = assertResult(await client.callTool({ name: "eh_search_by_file", arguments: { path: localFixture } }), "file search");
  } finally {
    await rm(localFixture, { force: true });
  }
  if (!fileSearch.result?.sha1) throw new Error("Local file search returned no SHA-1");

  const metadata = assertResult(await client.callTool({
    name: "eh_get_gallery_metadata",
    arguments: { galleries: [gallery] },
  }), "metadata");
  if (metadata.galleries?.[0]?.gid !== gallery.gid) throw new Error("Metadata response did not contain the requested gallery");

  const batch = assertResult(await client.callTool({
    name: "eh_get_gallery_metadata_batch",
    arguments: { galleries: [gallery, gallery] },
  }), "metadata batch");
  if (batch.galleries?.length !== 2 || batch.galleries.some((entry) => entry.gid !== gallery.gid)) {
    throw new Error("Metadata batch did not preserve duplicate entries in input order");
  }

  const access = assertResult(await client.callTool({
    name: "eh_check_access",
    arguments: { site: "e-hentai" },
  }), "access");
  if (access.result?.reachable !== true) throw new Error("E-Hentai access check failed");

  const pages = assertResult(await client.callTool({
    name: "eh_get_gallery_pages",
    arguments: { gallery },
  }), "gallery pages");
  if (!pages.result?.pages?.length) throw new Error("Gallery page response was empty");

  let allPageCount = null;
  if (completePagesCandidate) {
    const completePagesGallery = { gid: completePagesCandidate.gid, token: completePagesCandidate.token };
    const allPages = assertResult(await client.callTool({ name: "eh_get_all_gallery_pages", arguments: { gallery: completePagesGallery, maxImages: 60 } }), "all gallery pages");
    allPageCount = allPages.result.pages.length;
    if (allPageCount !== completePagesCandidate.pages) throw new Error("Complete gallery page enumeration was incomplete");
  }

  const comments = assertResult(await client.callTool({ name: "eh_get_gallery_comments", arguments: { gallery } }), "comments");
  if (comments.result?.comments?.some((comment) => comment.untrusted !== true)) throw new Error("Comment trust marker was missing");

  const first = pages.result.pages[0];
  const hash = first.thumbnailUrl?.match(/\/([0-9a-f]{40})-/i)?.[1] ?? null;
  let hashResultCount = null;
  if (hash) {
    const hashSearch = assertResult(await client.callTool({
      name: "eh_search_by_hash",
      arguments: { sha1: hash },
    }), "hash search");
    hashResultCount = hashSearch.result?.galleries?.length ?? 0;
  }

  const resolved = assertResult(await client.callTool({
    name: "eh_resolve_gallery",
    arguments: { page: { gid: gallery.gid, pageToken: first.pageToken, page: first.page } },
  }), "resolve gallery");
  if (resolved.gallery?.gid !== gallery.gid) throw new Error("Resolved gallery did not match the source page");

  const resolvedBatch = assertResult(await client.callTool({
    name: "eh_resolve_gallery_batch",
    arguments: { pages: [
      { gid: gallery.gid, pageToken: first.pageToken, page: first.page },
      { gid: gallery.gid, pageToken: first.pageToken, page: first.page },
    ] },
  }), "resolve gallery batch");
  if (resolvedBatch.results?.length !== 2 || resolvedBatch.results.some((entry) => entry.gid !== gallery.gid || !entry.token)) {
    throw new Error("Batch gallery resolution did not preserve duplicate entries");
  }

  const image = assertResult(await client.callTool({
    name: "eh_get_image_page",
    arguments: { page: { gid: gallery.gid, pageToken: first.pageToken, page: first.page } },
  }), "image page");
  if (!image.result?.imageUrl) throw new Error("Image page response had no image URL");

  const chain = assertResult(await client.callTool({
    name: "eh_get_gallery_chain",
    arguments: { gallery },
  }), "gallery chain");
  if (!chain.galleries?.length) throw new Error("Gallery chain response was empty");

  const latest = assertResult(await client.callTool({ name: "eh_find_latest_gallery_version", arguments: { gallery } }), "latest version");
  if (!latest.gallery?.gid) throw new Error("Latest version response was empty");
  const comparison = assertResult(await client.callTool({ name: "eh_compare_gallery_versions", arguments: { before: gallery, after: { gid: latest.gallery.gid, token: latest.gallery.token } } }), "version comparison");
  if (!comparison.result?.changes) throw new Error("Version comparison response was empty");

  let torrentCount = 0;
  if (detail.result.gallery.torrentCount > 0) {
    const torrents = assertResult(await client.callTool({
      name: "eh_get_torrents",
      arguments: { gallery },
    }), "torrents");
    torrentCount = torrents.torrents?.length ?? 0;
    if (!torrentCount) throw new Error("Gallery advertised torrents but the torrent list was empty");
  }

  console.log(JSON.stringify({
    toolCount: tools.tools.length,
    selectedGid: gallery.gid,
    popularCount: candidates.length,
    metadataGid: metadata.galleries[0].gid,
    batchCount: batch.galleries.length,
    hashResultCount,
    localFileSha1: fileSearch.result.sha1,
    builtQuery: query.result.query,
    translatedTagCount: translatedTags.result.matches.length,
    translatedTag: translatedTag.tag,
    normalizedTitleTag: translatedTitleMatch.tag,
    tagDefinitionTitle: tagDefinition.result.title,
    detailTagGroups: detail.result.tagGroups.length,
    torrentCount,
    accessReachable: access.result.reachable,
    chainCount: chain.galleries.length,
    latestGid: latest.gallery.gid,
    commentCount: comments.result.comments.length,
    totalPages: pages.result.totalPages,
    previewCount: pages.result.pages.length,
    allPageCount,
    resolvedGid: resolved.gallery.gid,
    resolvedBatchCount: resolvedBatch.results.length,
    hasOriginalImage: Boolean(image.result.originalImageUrl),
    hasNextPage: Boolean(image.result.nextPageUrl),
  }, null, 2));
} finally {
  await client.close();
}
