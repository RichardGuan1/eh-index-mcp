import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { EhClient } from "../src/client.js";
import { parseTagDefinition } from "../src/parsers.js";
import { SerialRateLimiter } from "../src/rate-limiter.js";

describe("tag definitions", () => {
  it("reports an EHWiki Cloudflare challenge explicitly", () => {
    const challenge = '<html><title>Just a moment...</title><div id="challenge-platform"></div></html>';

    expect(() => parseTagDefinition(challenge, "https://ehwiki.org/wiki/ai_generated"))
      .toThrow("Cloudflare challenge");
  });

  it("extracts structured definition fields and keeps the source untrusted", async () => {
    const html = await readFile(new URL("./fixtures/tag-definition.html", import.meta.url), "utf8");
    expect(parseTagDefinition(html, "https://ehwiki.org/wiki/ai_generated")).toEqual({
      title: "AI Generated",
      description: "Contains the [AI Generated] indicator within the title.",
      tagType: "Technical / Visual",
      slaveTags: ["Other"],
      notes: "May not be directly voted and is applied automatically.",
      sourceUrl: "https://ehwiki.org/wiki/ai_generated",
      untrusted: true,
    });
  });

  it("keeps the tag-level fields when later sections repeat labels", () => {
    const html = `<h1 id="firstHeading">ai generated</h1>
      <div id="mw-content-text"><div class="mw-parser-output">
        <ul>
          <li><b>Tag Type</b>: Technical / Visual</li>
          <li><b>Notes</b>: Tag-level notes.</li>
          <li><b>Description</b>: Tag-level description.</li>
        </ul>
        <h2>Indicator</h2>
        <ul>
          <li><b>Notes</b>: Indicator-only notes.</li>
          <li><b>Description</b>: Indicator-only description.</li>
        </ul>
      </div></div>`;

    expect(parseTagDefinition(html, "https://ehwiki.org/wiki/ai_generated"))
      .toEqual(expect.objectContaining({
        description: "Tag-level description.",
        notes: "Tag-level notes.",
      }));
  });

  it("constructs a fixed EHWiki URL from a tag name", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toBe("https://ehwiki.org/wiki/ai_generated");
      return new Response(await readFile(new URL("./fixtures/tag-definition.html", import.meta.url), "utf8"));
    });
    const client = new EhClient({ fetch: fetchMock as typeof fetch, pageLimiter: new SerialRateLimiter(0) });
    await expect(client.lookupTagDefinition("ai generated")).resolves.toEqual(expect.objectContaining({ title: "AI Generated" }));
  });

  it("does not send E-Hentai identity cookies to EHWiki", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("cookie")).toBeNull();
      return new Response(await readFile(new URL("./fixtures/tag-definition.html", import.meta.url), "utf8"));
    });
    const client = new EhClient({
      fetch: fetchMock as typeof fetch,
      cookies: { memberId: "42", passHash: "secret", cfClearance: "clearance" },
      pageLimiter: new SerialRateLimiter(0),
    });

    await client.lookupTagDefinition("ai generated");
  });
});