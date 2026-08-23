<div align="center">

<img src="assets/eh-index-icon.png" alt="EH Index MCP logo" width="160">

# EH Index MCP

**A read-only MCP server for searching and exploring E-Hentai and ExHentai.**

**English** | [简体中文](README.zh-CN.md)

[![npm version](https://img.shields.io/npm/v/eh-index-mcp?color=cb3837&logo=npm)](https://www.npmjs.com/package/eh-index-mcp)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520.3-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/Model_Context_Protocol-compatible-5c5c5c)](https://modelcontextprotocol.io/)
[![license](https://img.shields.io/github/license/RichardGuan1/eh-index-mcp)](LICENSE)

Search galleries, follow version chains, resolve image pages, inspect metadata, translate tags, and organize related uploads without modifying your account.

[Quick start](#quick-start) &middot; [What it does](#what-it-does) &middot; [Tool catalog](#tool-catalog) &middot; [Authentication](#authentication) &middot; [Development](#development)

</div>

---

## What it does

| | Capability | What you get |
| --- | --- | --- |
| **Search** | Native gallery search | E-Hentai query syntax, categories, filters, cursors, SHA-1 search, and local-file hashing without file uploads |
| **Similarity** | EhViewer-compatible discovery | Structural title extraction with quoted-title, artist, and uploader fallbacks |
| **Organization** | Works, variants, and series | Multi-page result scanning with official version links, upload deduplication, language variants, explicit grouping evidence, confidence levels, and source preservation |
| **Metadata** | Gallery and image details | Official metadata, tags, untrusted descriptions and comments, version comparisons, preview pages, image-page links, and torrent metadata |
| **Tag lookup** | Chinese and English tag resolution | Runtime lookup through EhTagTranslation plus structured EHWiki definitions |
| **Account data** | Optional authenticated reads | Watched Tags, favorite categories, favorite details, archive options, and ExHentai access, with no write operations |

EH Index MCP exposes **30 read-only tools**. It does not modify watched tags or favorites, purchase archives, download galleries, or upload local files.

![EH Index MCP CLI demo](assets/demo.png)

## Quick start

### Run with npx

```bash
npx -y eh-index-mcp
```

Public E-Hentai search and metadata work without an account.

### Add it to an MCP client

```json
{
  "mcpServers": {
    "eh-index": {
      "command": "npx",
      "args": ["-y", "eh-index-mcp"]
    }
  }
}
```

Restart the client after saving the configuration. The server communicates over stdio and writes protocol messages only to stdout.

<details>
<summary><strong>Global installation</strong></summary>

```bash
npm install --global eh-index-mcp
eh-index-mcp
```

Requires Node.js 20.3 or newer.

</details>

## Common workflows

### Find galleries related to one upload

Use `eh_find_similar_galleries` with a gallery URL or `gid` and token. The tool follows EhViewer's search strategy:

1. Extract a stable title from structural wrappers such as event, group, language, and edition markers.
2. Search the extracted title as an exact phrase.
3. Fall back to the first artist tag, then the uploader, when no usable title remains.

The response reports the selected strategy and native query alongside the gallery results.

### Turn search results into works and series

`eh_search_gallery_works` scans up to ten result pages and organizes the response into:

- gallery uploads;
- likely variants of the same work;
- related works grouped into series;
- official parent/newer-version relationships;
- confidence levels and complete source-gallery references.

The grouping logic reports whether each work came from an official version chain, a heuristic normalized-title-and-creator match, or a standalone fallback. Low-confidence items remain separate.

### Search across a controlled page budget

`eh_search_galleries_batch` scans up to ten ordinary search pages without fetching gallery metadata. It deduplicates gallery references, reports the pages scanned, and returns a resume cursor when the requested page budget truncates the scan.

### Read Watched Tags without changing account state

`eh_search_watched` reads the authenticated Watched Tags feed using the same native query, category, advanced-filter, and cursor controls as ordinary search. It never changes watched tags or other account settings.

### Search from a local image

`eh_search_by_file` reads one explicit local file, calculates its SHA-1 digest, and performs an exact hash search. The image is never uploaded. Relative paths, directories, wildcards, and files above the configured size limit are rejected.

### Resolve Chinese tag names

`eh_search_translated_tags` maps Chinese translated names and English originals to formal E-Hentai tags. Results include a native query fragment ready for `eh_search_galleries`. Matching handles Unicode width, punctuation, symbols, and spacing while preserving the source text.

## Tool catalog

<details>
<summary><strong>Search and discovery (9 tools)</strong></summary>

| Tool | Purpose |
| --- | --- |
| `eh_search_galleries` | Search E-Hentai or ExHentai with native syntax, filters, categories, and cursor pagination |
| `eh_search_galleries_batch` | Scan up to ten search pages with deduplication and a resumable cursor |
| `eh_find_similar_galleries` | Find related galleries with EhViewer's quoted-title, artist, and uploader strategy |
| `eh_search_gallery_works` | Scan multiple result pages and organize uploads into variants, works, and series |
| `eh_search_by_hash` | Search by an exact 40-character SHA-1 image hash |
| `eh_search_by_file` | Hash one explicit local file and search it without uploading the file |
| `eh_build_search_query` | Build and validate include, exclude, OR, exact-tag, and title queries |
| `eh_get_search_capabilities` | List supported categories, namespaces, qualifiers, operators, and query limits |
| `eh_get_popular` | Read the current popular gallery list |

</details>

<details>
<summary><strong>Metadata and versions (7 tools)</strong></summary>

| Tool | Purpose |
| --- | --- |
| `eh_get_gallery_metadata` | Fetch official metadata for up to 25 galleries |
| `eh_get_gallery_metadata_batch` | Fetch metadata for up to 500 galleries while preserving order and per-item errors |
| `eh_get_gallery_detail` | Read gallery fields, grouped tags, rating statistics, untrusted uploader description, parents, and newer versions |
| `eh_get_gallery_comments` | Read uploader and user comments as untrusted text |
| `eh_get_gallery_chain` | Build an ordered, deduplicated gallery-version chain |
| `eh_find_latest_gallery_version` | Resolve the latest semantic entry in a version chain |
| `eh_compare_gallery_versions` | Compare titles, dates, page counts, sizes, and tag changes |

</details>

<details>
<summary><strong>Pages and resolution (5 tools)</strong></summary>

| Tool | Purpose |
| --- | --- |
| `eh_get_gallery_pages` | List page numbers, page tokens, URLs, and preview thumbnails |
| `eh_get_all_gallery_pages` | Enumerate all preview pages with a caller-supplied image limit |
| `eh_get_image_page` | Resolve displayed/original image links and page navigation data |
| `eh_resolve_gallery` | Resolve one image-page URL or page token to its gallery token |
| `eh_resolve_gallery_batch` | Resolve up to 500 image-page references with order and errors preserved |

</details>

<details>
<summary><strong>Access and account data (6 tools)</strong></summary>

| Tool | Purpose |
| --- | --- |
| `eh_check_access` | Diagnose reachability, authentication, ExHentai access, and Cloudflare state |
| `eh_search_watched` | Read the authenticated Watched Tags feed without changing account state |
| `eh_search_favorites` | Search authenticated favorites with categories and cursors |
| `eh_get_favorite_categories` | Read favorite category names, counts, total, and current selection |
| `eh_get_favorite_detail` | Read one gallery's favorite category, note, and timestamp |
| `eh_get_archive_options` | Read archive balance, resolutions, sizes, and costs without purchasing |

</details>

<details>
<summary><strong>Torrents and tag knowledge (3 tools)</strong></summary>

| Tool | Purpose |
| --- | --- |
| `eh_get_torrents` | Read current and outdated torrent metadata and official `.torrent` links |
| `eh_lookup_tag_definition` | Read structured EHWiki definitions, relationships, notes, and source URLs |
| `eh_search_translated_tags` | Resolve Chinese or English names through the EhTagTranslation database |

</details>

## Authentication

Authentication is optional. Public E-Hentai tools work without cookies. Favorites, archive metadata, and ExHentai require identity cookies from a browser session you control.

| Environment variable | Browser cookie | Used for |
| --- | --- | --- |
| `EH_MEMBER_ID` | `ipb_member_id` | Favorites, archive options, and authenticated access |
| `EH_PASS_HASH` | `ipb_pass_hash` | Favorites, archive options, and authenticated access |
| `EH_IGNEOUS` | `igneous` | ExHentai access |
| `EH_CF_CLEARANCE` | `cf_clearance` | Optional Cloudflare session compatibility |

Never provide an account password. Store cookie values in the MCP host's environment or secret manager rather than committing them to a configuration file.

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

The server sends identity cookies only to E-Hentai and ExHentai hosts. Tools never return cookie values, and the server does not log them.

## Safety model

| Boundary | Behavior |
| --- | --- |
| Account state | Read-only; no favorite mutations or account changes |
| Archives | Reports options and costs; never purchases or returns archive keys |
| Images | Resolves links and metadata; never downloads galleries |
| Local files | Hashes only the explicit file supplied by the caller; never uploads it |
| External text | Marks gallery titles, tags, comments, and wiki text as untrusted data |
| Credentials | Restricts identity cookies to E-Hentai and ExHentai hosts |
| Rate limits | Serializes request classes, caches responses, and retries transient failures with bounded backoff |

## Configuration

The defaults are conservative for E-Hentai's shared-IP limits. Increase intervals rather than lowering them when several clients share one exit address.

<details>
<summary><strong>Optional environment variables</strong></summary>

| Variable | Default | Purpose |
| --- | ---: | --- |
| `EH_TIMEOUT_MS` | `30000` | Per-operation timeout, including retries |
| `EH_MAX_RETRIES` | `2` | Retries for HTTP 429, 502, 503, and 504 |
| `EH_RETRY_BASE_MS` | `1000` | Exponential-backoff base delay; `Retry-After` takes priority |
| `EH_SEARCH_INTERVAL_MS` | `3000` | Minimum interval between search and favorites requests |
| `EH_PAGE_INTERVAL_MS` | `1000` | Minimum interval between ordinary HTML requests |
| `EH_API_INTERVAL_MS` | `1250` | Minimum interval between API requests |
| `EH_SHORT_CACHE_TTL_MS` | `30000` | Search and image-page cache TTL; `0` disables it |
| `EH_POPULAR_CACHE_TTL_MS` | `60000` | Popular-list cache TTL; `0` disables it |
| `EH_LONG_CACHE_TTL_MS` | `300000` | Metadata, detail, preview, torrent, and tag-definition cache TTL |
| `EH_MAX_LOCAL_FILE_BYTES` | `33554432` | Maximum size of one local file used for SHA-1 search |

All values must be non-negative integers.

If Node.js 24 or newer reaches E-Hentai through an HTTP proxy, pass `HTTP_PROXY`, `HTTPS_PROXY`, and `NODE_USE_ENV_PROXY=1` to the server process.

</details>

## Data sources and attribution

- Gallery data comes from E-Hentai and ExHentai pages and APIs.
- Similar-gallery title extraction is adapted from [EhViewer](https://github.com/EhViewer-NekoInverter/EhViewer) under Apache-2.0. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Tag translations are fetched at runtime from [EhTagTranslation/Database](https://github.com/EhTagTranslation/Database). The database is not bundled with this package and remains under its own per-file notices and CC BY-NC-SA 3.0 CN license.
- Tag definitions come from EHWiki and are returned with source URLs as untrusted external content.

## Development

```bash
npm install
npm run check
npm run smoke
```

`npm run check` builds the project and runs the automated test suite. `npm run smoke` exercises the built stdio server against a small public live-data workflow without downloading gallery images or torrent files.

An optional authenticated smoke test is available for maintainers with existing cookies:

```bash
npm run smoke:auth
```

It performs read-only checks and suppresses credentials, gallery identifiers, titles, category names, and notes from its output.

## Acknowledgements

EH Index MCP builds on the work of the following projects and communities:

- [E-Hentai and ExHentai](https://e-hentai.org/) for the gallery platform and public interfaces.
- [EhViewer-NekoInverter](https://github.com/EhViewer-NekoInverter/EhViewer) for the similar-gallery title extraction strategy.
- [EhTagTranslation](https://github.com/EhTagTranslation/Database) for the Chinese tag translation database.
- [EHWiki](https://ehwiki.org/) for structured tag definitions.
- [Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) for the MCP server foundation.

Their respective content, data, and source code remain subject to their own licenses.

## Project links

- [npm package](https://www.npmjs.com/package/eh-index-mcp)
- [Source code](https://github.com/RichardGuan1/eh-index-mcp)
- [Issue tracker](https://github.com/RichardGuan1/eh-index-mcp/issues)
- [Releases](https://github.com/RichardGuan1/eh-index-mcp/releases)

## Disclaimer

EH Index MCP is an unofficial community project. It is not affiliated with, endorsed by, or operated by E-Hentai, ExHentai, or their operators. Users are responsible for complying with applicable laws, site rules, and account requirements. Site availability, page structure, and returned data may change without notice.

## License

The project source code is available under the [MIT License](LICENSE). Third-party data and adapted logic retain their respective licenses as described above and in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
