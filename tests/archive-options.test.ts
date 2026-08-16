import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { EhClient } from "../src/client.js";
import { parseArchiveOptions } from "../src/parsers.js";
import { SerialRateLimiter } from "../src/rate-limiter.js";

describe("archive options", () => {
  it("parses balances and read-only archive choices without purchase secrets", async () => {
    const html = await readFile(new URL("./fixtures/archive-options.html", import.meta.url), "utf8");
    const result = parseArchiveOptions(html);
    expect(result).toEqual({
      balance: "12,345 GP",
      options: [
        { kind: "original", resolution: "original", size: "419.5 MiB", cost: "8,390 GP" },
        { kind: "resample", resolution: "1280x", size: "120.0 MiB", cost: "2,400 GP" },
        { kind: "hath", resolution: "1600x", size: "180.0 MiB", cost: "3,600 GP" },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("secret-archive-key");
  });

  it("preserves a free archive cost", () => {
    const html = `<html><body>
      <div>GP Balance: 12,345 GP</div>
      <table><tr>
        <td><input type="radio" name="dltype" value="org"></td>
        <td>Original Archive</td><td>10 MiB</td><td>Free</td>
      </tr></table>
    </body></html>`;

    expect(parseArchiveOptions(html).options[0]?.cost).toBe("Free");
  });

  it("reports an H@H original archive as original resolution", () => {
    const html = `<table><tr>
      <td><input type="radio" name="dltype" value="hath_original"></td>
      <td>H@H Downloader Original</td><td>419.5 MiB</td><td>8,390 GP</td>
    </tr></table>`;

    expect(parseArchiveOptions(html).options[0]).toEqual({
      kind: "hath",
      resolution: "original",
      size: "419.5 MiB",
      cost: "8,390 GP",
    });
  });

  it("requires credentials before requesting archive options", async () => {
    const fetchMock = vi.fn();
    const client = new EhClient({ fetch: fetchMock as typeof fetch, pageLimiter: new SerialRateLimiter(0) });
    await expect(client.getArchiveOptions({ gid: 123, token: "123456789a" })).rejects.toThrow("EH_MEMBER_ID");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});