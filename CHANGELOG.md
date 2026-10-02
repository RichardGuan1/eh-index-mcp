# Changelog

## [0.3.0] - 2026-10-01

### Changed

- Reorganized MCP server registration by search, gallery, version, page, and account domains without changing the 30-tool interface.
- Reorganized client transport, authentication, metadata, pagination, search, and version workflows behind the existing `EhClient` interface.
- Reorganized HTML parsing by gallery, page, account, tag, and shared parsing responsibilities while preserving existing parser exports.
- Consolidated small internal helper modules into larger domain-oriented modules.

## [0.2.0] - 2026-09-30

### Added

- Added stable structured error codes with retryability and request context for authentication, rate limits, challenges, upstream failures, parsing failures, and network errors.
- Added input-count, success-count, error-count, and order-preservation fields to batch results.
- Added explicit site fields to gallery summaries and organized gallery variants so references can be passed between tools without inferring the site from a URL.
- Added four built-in read-only prompts for gallery research, version comparison, version-chain audits, and tag research.

## [0.1.2] - 2026-08-24

### Fixed

- Preserved ExHentai host context when parsing the popular gallery list.
- Restored gallery metadata to caller input order even when the upstream API reorders unique rows.
- Made creator-backed gallery-work grouping deterministic and merged bridged candidate groups transitively.
- Rejected login pages at the shared HTML parser boundary instead of returning misleading empty results.
- Classified rejected credentials as reachable but unauthenticated in access diagnostics.

### Quality

- Added regression coverage for reordered metadata, ExHentai popular links, expired login pages, and read-only MCP annotations.
- Added a packaged stdio initialize/tools-list smoke check for release artifacts.
- Added descriptions to every top-level input parameter exposed in the 30-tool MCP schemas, with a regression test that rejects undocumented parameters.
- Added `glama.json` ownership and catalog metadata for Glama discovery and maintenance.
- Added a multi-stage production Dockerfile with a non-root Node.js runtime and a Docker build gate in CI.

## [0.1.1] - 2026-08-24

### Added

- Added `eh_search_watched` for authenticated, read-only Watched Tags feeds with native search filters and cursor pagination.
- Added `eh_search_galleries_batch` for controlled multi-page gallery searches with deduplication and resumable cursors.
- Added sanitized, explicitly untrusted uploader descriptions to `eh_get_gallery_detail`.
- Added `groupingBasis` and `groupingExplanation` to organized works so clients can distinguish official version chains, heuristic title/creator matches, and standalone results.
- Added official MCP Registry metadata in `server.json` and aligned the package's `mcpName` and version metadata.

### Fixed

- Preserved the originating E-Hentai or ExHentai host when resolving relative gallery, preview-page, and image-page links.
- Enabled the native advanced-search switches required for minimum-rating and page-count filters.

### Documentation

- Updated the bilingual README tool catalog and workflows for the 30-tool surface.
