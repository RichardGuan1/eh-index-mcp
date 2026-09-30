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
