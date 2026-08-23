# Changelog

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
