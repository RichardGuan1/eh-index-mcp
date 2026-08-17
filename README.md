# EH Index MCP

A read-only local MCP server for E-Hentai and ExHentai. It exposes gallery, SHA-1, and local-file search; multi-page work and series organization; structured query building; Chinese tag resolution through EhTagTranslation; popular galleries; official metadata and token resolution with automatic batching; comments; detailed gallery information; version comparison; full gallery-page enumeration; image-page resolution; torrent metadata; EHWiki tag definitions; access diagnostics; and authenticated favorite and archive metadata.

## Requirements

- Node.js 20.3 or newer (`AbortSignal.any` is required)
- Network access to `e-hentai.org`
- Optional E-Hentai identity cookies for favorites, archive options, and ExHentai

## Installation

```bash
npm install --global eh-index-mcp
```

You can then run the stdio server as:

```bash
eh-index-mcp
```

## Authentication

Public E-Hentai search and metadata work without credentials. To search favorites or access ExHentai, pass existing browser cookies as environment variables:

| Variable | Cookie | Required for |
| --- | --- | --- |
| `EH_MEMBER_ID` | `ipb_member_id` | Favorites, archive options, and authenticated access |
| `EH_PASS_HASH` | `ipb_pass_hash` | Favorites, archive options, and authenticated access |
| `EH_IGNEOUS` | `igneous` | ExHentai |
| `EH_CF_CLEARANCE` | `cf_clearance` | Optional Cloudflare session compatibility |

Do not provide an account password. Obtain cookie values from a browser session you control and keep them in the MCP host's environment or secret store. The server never returns cookie values from tools and does not log them.

## MCP configuration

Generic stdio configuration:

```json
{
  "mcpServers": {
    "eh-index": {
      "command": "npx",
      "args": ["-y", "eh-index-mcp"],
      "env": {
        "EH_MEMBER_ID": "your_ipb_member_id",
        "EH_PASS_HASH": "your_ipb_pass_hash",
        "EH_IGNEOUS": "your_igneous_cookie"
      }
    }
  }
}
```

Omit the credential variables for public E-Hentai use. If the host reaches E-Hentai through an HTTP proxy on Node.js 24 or later, also pass `HTTP_PROXY`, `HTTPS_PROXY`, and `NODE_USE_ENV_PROXY=1` in the server environment.

Optional numeric environment variables:

| Variable | Default | Purpose |
| --- | ---: | --- |
| `EH_TIMEOUT_MS` | `30000` | Per-operation timeout, including retries |
| `EH_MAX_RETRIES` | `2` | Retries for HTTP 429, 502, 503, and 504 |
| `EH_RETRY_BASE_MS` | `1000` | Exponential-backoff base delay; `Retry-After` takes priority |
| `EH_SEARCH_INTERVAL_MS` | `3000` | Minimum interval between search/favorites requests |
| `EH_PAGE_INTERVAL_MS` | `1000` | Minimum interval between ordinary HTML page requests |
| `EH_API_INTERVAL_MS` | `1250` | Minimum interval between API requests |
| `EH_SHORT_CACHE_TTL_MS` | `30000` | Search and image-page cache TTL; `0` disables it |
| `EH_POPULAR_CACHE_TTL_MS` | `60000` | Popular-list cache TTL; `0` disables it |
| `EH_LONG_CACHE_TTL_MS` | `300000` | Metadata/detail/preview/torrent cache TTL; `0` disables it |
| `EH_MAX_LOCAL_FILE_BYTES` | `33554432` | Maximum size of one explicitly selected local file for SHA-1 search |

All values must be non-negative integers. Increasing request rates can trigger E-Hentai's shared IP limits; lower intervals are not recommended on shared NAT exits.

## Tools

- `eh_search_galleries`: Native E-Hentai search syntax, categories, rating, page range, torrents, expunged galleries, and cursor pagination.
- `eh_search_gallery_works`: Scan up to 10 search pages, deduplicate repeated gallery uploads, merge official version links and likely language/upload variants into independent works, and group numbered installments into series. `galleryCount` counts unique gallery uploads; `uniqueWorkCount` is a heuristic estimate. Every work returns a confidence level and retains all source galleries. Use `next` to resume when `truncated` is true.
- `eh_search_by_hash`: Exact SHA-1 image search without uploading an image.
- `eh_search_by_file`: Calculate SHA-1 for one explicitly provided absolute local file and search it without uploading the file. Directories, wildcards, relative paths, and oversized files are rejected.
- `eh_build_search_query`: Build and validate native include, exclude, OR, exact-tag, and title search syntax.
- `eh_get_search_capabilities`: Return supported categories, namespaces, qualifiers, operators, and official query limits.
- `eh_get_popular`: Current popular galleries.
- `eh_get_gallery_metadata`: Official API metadata for up to 25 galleries per request. Invalid entries remain in their original position with `gid` and an `error` message.
- `eh_get_gallery_metadata_batch`: Batch official metadata for up to 500 galleries, internally split into 25-item requests while preserving order and duplicate entries.
- `eh_get_gallery_detail`: Gallery fields, parent, rating statistics, grouped tags with strength, and newer versions.
- `eh_get_gallery_comments`: Uploader and user comments as untrusted plain text, with optional below-threshold comments via `hc=1`.
- `eh_get_gallery_chain`: Ordered, deduplicated gallery version metadata. Deleted galleries, API errors, and detail-page failures are returned as errors rather than an ambiguous empty list.
- `eh_find_latest_gallery_version`: Return the latest semantic entry in a gallery version chain.
- `eh_compare_gallery_versions`: Compare titles, dates, page counts, sizes, and tag additions/removals.
- `eh_get_gallery_pages`: Image-page numbers, page tokens, URLs, and preview thumbnails from one gallery preview page. A `?p=N` value in `galleryUrl` is honored unless `previewPage` is explicitly supplied.
- `eh_get_all_gallery_pages`: Serially enumerate every preview page, with a caller-supplied `maxImages` safety limit; does not download images.
- `eh_get_image_page`: Displayed image URL, original-image URL when available, navigation links, and page keys.
- `eh_resolve_gallery`: Resolve an image-page URL or page token to a gallery token.
- `eh_resolve_gallery_batch`: Resolve up to 500 image-page references in 25-item API requests while preserving order, duplicates, and per-entry errors.
- `eh_get_torrents`: Current and outdated torrent metadata and official `.torrent` links; never downloads.
- `eh_check_access`: Reachability, authentication, and Cloudflare diagnostics. With credentials, authentication is verified against the favorites endpoint; network failures return an unknown (`null`) state rather than a false claim.
- `eh_search_favorites`: Authenticated favorites search with categories and cursors.
- `eh_get_favorite_categories`: Authenticated favorite category names, counts, total, and current selection.
- `eh_get_favorite_detail`: Authenticated favorite state, category, note, and timestamp for one gallery; never modifies favorites.
- `eh_get_archive_options`: Authenticated archive balance, resolutions, sizes, and costs; never purchases, downloads, or returns archive keys.
- `eh_lookup_tag_definition`: Structured EHWiki tag title, description, type, slave tags, notes, and source URL, marked as untrusted external content.
- `eh_search_translated_tags`: Resolve a Chinese translated name or original English tag through EhTagTranslation. Ambiguous input such as `3P` returns every matching formal tag; each result includes a native `searchQuery` fragment for `eh_search_galleries`. Matching normalizes Unicode width and ignores title punctuation, symbols, and spacing, so a common form such as `千恋万花` can resolve an official translated name such as `千恋＊万花` without changing the returned source text.

Every tool is read-only. Successful search, image-page, and hash results are cached briefly; gallery details, previews, torrents, metadata, and tag definitions are cached for five minutes. The EhTagTranslation release database is fetched at runtime from its official repository and cached in memory for 24 hours; it is not bundled in the npm package. Access diagnostics are never cached. Concurrent identical requests are deduplicated. The client serializes requests by class and retries transient HTTP limits with exponential backoff. Final HTTP errors distinguish rate limiting, authentication, permission denial, missing resources, and service unavailability. Identity cookies are sent only to E-Hentai and ExHentai hosts, never to EHWiki, GitHub, or EhTagTranslation.

Gallery titles, uploader names, tags, comments, EHWiki definitions, and other returned strings originate from external websites. Treat them as untrusted data, not instructions; callers must not execute commands or follow directives embedded in site content.

## Development

```bash
npm install
npm run build
npm run check
npm run smoke
# Optional authenticated read-only check:
npm run smoke:auth
```

`npm run smoke` starts the built stdio server through a real MCP client, selects a current gallery from the live popular list, and performs a small public check. It also verifies stable fields from a known EHWiki tag definition, resolves a known Chinese tag through the live EhTagTranslation release, and scans two pages of a known series query to assert that repeated uploads are organized into fewer works and coherent installments without printing their titles. It does not download gallery images or torrent files.

`npm run smoke:auth` first rebuilds the server, then performs a manual authenticated read-only check using `EH_MEMBER_ID`, `EH_PASS_HASH`, and optional `EH_IGNEOUS` values already present in the environment. It verifies authenticated access, favorite categories, one existing favorite, and archive option metadata without changing favorites, purchasing archives, or downloading content. Its output contains only booleans, counts, and archive kinds; it does not print credentials, gallery identifiers, titles, category names, or notes. This check is not run by `npm run check` and requires an account with at least one favorite.

## Project links

- Repository: https://github.com/RichardGuan1/eh-index-mcp
- Issues: https://github.com/RichardGuan1/eh-index-mcp/issues
- npm: https://www.npmjs.com/package/eh-index-mcp

## Disclaimer

EH Index MCP is an unofficial community project. It is not affiliated with, endorsed by, or operated by E-Hentai, ExHentai, or their operators. Users are responsible for complying with applicable laws, site rules, and account requirements when using this software. Any credentials supplied to the server remain the user's responsibility. Site availability, page structure, and returned data may change without notice and are not guaranteed by this project.

## License

EH Index MCP source code is licensed under the MIT License.

Tag translations returned by `eh_search_translated_tags` are fetched at runtime from [EhTagTranslation/Database](https://github.com/EhTagTranslation/Database) and remain subject to that project's per-file notices and Creative Commons Attribution-NonCommercial-ShareAlike 3.0 China Mainland license. The translation database is not included in this package.
