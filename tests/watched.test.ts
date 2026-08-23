import { describe, expect, it, vi } from "vitest";
import { EhClient } from "../src/client.js";
import * as urls from "../src/urls.js";
import type { SearchOptions } from "../src/types.js";

const buildWatchedUrl = (urls as unknown as {
  buildWatchedUrl(options: SearchOptions): string;
}).buildWatchedUrl;

describe("watched gallery search", () => {
  it("builds an ExHentai watched URL with search filters and cursors", () => {
    const url = new URL(buildWatchedUrl({
      site: "exhentai",
      query: "language:chinese$",
      minRating: 4,
      pageFrom: 20,
      next: "4000000",
    }));

    expect(url.hostname).toBe("exhentai.org");
    expect(url.pathname).toBe("/watched");
    expect(url.searchParams.get("f_search")).toBe("language:chinese$");
    expect(url.searchParams.get("f_sr")).toBe("on");
    expect(url.searchParams.get("f_srdd")).toBe("4");
    expect(url.searchParams.get("f_sp")).toBe("on");
    expect(url.searchParams.get("f_spf")).toBe("20");
    expect(url.searchParams.get("next")).toBe("4000000");
  });

  it("rejects watched searches before requesting when credentials are missing", async () => {
    const client = new EhClient();
    const searchWatched = (client as unknown as {
      searchWatched(options: SearchOptions): Promise<unknown>;
    }).searchWatched.bind(client);

    await expect(searchWatched({})).rejects.toThrow("EH_MEMBER_ID and EH_PASS_HASH");
  });

  it("rejects expired credentials when the watched page redirects to login", async () => {
    const client = new EhClient({
      cookies: { memberId: "42", passHash: "expired" },
      fetch: vi.fn(async () => new Response('<html><title>E-Hentai.org Login</title><form name="ipb_login_form"></form></html>')) as typeof fetch,
    });

    await expect(client.searchWatched({})).rejects.toThrow("expired or were rejected");
  });
});
