# Changelog

## [0.2.0] - 2026-09-30

### Added

- Added typed, structured error results with stable error codes and request context.
- Added standardized batch result summaries with input, success, error, and order-preservation counts.
- Added explicit site fields to gallery summaries and organized gallery variants for composable references.
- Added four read-only workflow prompts for gallery research, version comparison, version-chain auditing, and tag research.
- Extended packaged stdio smoke coverage to prompts and structured tool-call success and error results.

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
