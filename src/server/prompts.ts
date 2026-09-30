import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";

const siteSchema = z.enum(["e-hentai", "exhentai"]);

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "eh_gallery_research",
    {
      title: "Research E-Hentai galleries",
      description: "Guide a read-only gallery research workflow using search, metadata, details, comments, and torrents.",
      argsSchema: z.object({
        site: siteSchema.default("e-hentai").describe("Target site: e-hentai or exhentai"),
        query: z.string().max(200).describe("Native E-Hentai search query"),
        goal: z.string().max(500).describe("What the research should establish"),
      }),
    },
    ({ site, query, goal }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            `Research goal: ${goal}`,
            `Target site: ${site}`,
            `Search query: ${query}`,
            "Use the read-only workflow: call eh_search_galleries first, then pass the returned site, gid, and token together into eh_get_gallery_metadata or eh_get_gallery_metadata_batch.",
            "Use eh_get_gallery_detail for page-level fields, eh_get_gallery_comments for comments, and eh_get_torrents for torrent records only when they serve the goal.",
            "Preserve gallery references exactly as (site, gid, token); do not infer the site from a URL when the structured site field is available.",
            "Report uncertainty, deleted or expunged galleries, authentication errors, and rate limits explicitly.",
          ].join("\n\n"),
        },
      }],
    }),
  );

  server.registerPrompt(
    "eh_gallery_compare",
    {
      title: "Compare gallery versions",
      description: "Guide a read-only comparison of two gallery versions.",
      argsSchema: z.object({
        site: siteSchema.default("e-hentai").describe("Target site"),
        before: z.string().describe("Older gallery URL or gid/token reference"),
        after: z.string().describe("Newer gallery URL or gid/token reference"),
        goal: z.string().max(500).describe("What differences matter"),
      }),
    },
    ({ site, before, after, goal }) => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text: [
      `Comparison goal: ${goal}`,
      `Target site: ${site}`,
      `Before reference: ${before}`,
      `After reference: ${after}`,
      "Resolve both references to (gid, token), then call eh_compare_gallery_versions. Use eh_get_gallery_metadata when additional fields are needed.",
      "Keep the site explicit and distinguish confirmed API changes from missing or expunged metadata.",
    ].join("\n\n") } }] }),
  );

  server.registerPrompt(
    "eh_gallery_version_audit",
    {
      title: "Audit gallery version chain",
      description: "Guide a read-only audit of a gallery's parent and newer-version chain.",
      argsSchema: z.object({
        site: siteSchema.default("e-hentai").describe("Target site"),
        gallery: z.string().describe("Gallery URL or gid/token reference"),
        goal: z.string().max(500).describe("What the version audit should establish"),
      }),
    },
    ({ site, gallery, goal }) => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text: [
      `Audit goal: ${goal}`,
      `Target site: ${site}`,
      `Gallery reference: ${gallery}`,
      "Resolve the reference, call eh_get_gallery_chain, then call eh_find_latest_gallery_version when the latest node is required.",
      "Preserve chain order and report deleted, expunged, ambiguous, or inaccessible nodes explicitly.",
    ].join("\n\n") } }] }),
  );

  server.registerPrompt(
    "eh_tag_research",
    {
      title: "Research gallery tags",
      description: "Guide a read-only translation and interpretation workflow for E-Hentai tags.",
      argsSchema: z.object({
        site: siteSchema.default("e-hentai").describe("Target site"),
        term: z.string().max(200).describe("Tag or translated term to investigate"),
        goal: z.string().max(500).describe("What the tag research should establish"),
      }),
    },
    ({ site, term, goal }) => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text: [
      `Tag research goal: ${goal}`,
      `Target site: ${site}`,
      `Term: ${term}`,
      "Call eh_search_translated_tags to find native namespace-qualified tags, then use eh_build_search_query or eh_search_galleries with the verified native token.",
      "Use eh_lookup_tag_definition only when a definition or source page is needed; preserve the distinction between translation and definition.",
    ].join("\n\n") } }] }),
  );
}
