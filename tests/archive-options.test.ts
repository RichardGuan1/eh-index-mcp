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

  it("parses the current form-based archive and H@H choices", () => {
    const html = `<html><body><div id="db">
      <p>Current Funds:</p><p>1,234 GP</p>
      <div><div>
        <div><div>Download Cost: 916 GP</div>
          <form><input type="hidden" name="dltype" value="org"><input type="submit" value="Download Original Archive"></form>
          <p>Estimated Size: 43.67 MiB</p>
        </div>
        <div><div>Download Cost: 120 GP</div>
          <form><input type="hidden" name="dltype" value="res"><input type="submit" value="Download Resample Archive"></form>
          <p>Estimated Size: 5.68 MiB</p>
        </div>
      </div></div>
      <div><p>H@H Downloader</p><form id="hathdl_form"><input type="hidden" name="hathdl_xres"></form>
        <table><tr>
          <td>Original 43.67 MiB 916 GP</td>
          <td>800x 2.76 MiB 58 GP</td>
          <td>1280x 5.68 MiB 120 GP</td>
          <td>2400x N/A N/A</td>
        </tr></table>
      </div>
    </div></body></html>`;

    expect(parseArchiveOptions(html)).toEqual({
      balance: "1,234 GP",
      options: [
        { kind: "original", resolution: "original", size: "43.67 MiB", cost: "916 GP" },
        { kind: "resample", resolution: "resampled", size: "5.68 MiB", cost: "120 GP" },
        { kind: "hath", resolution: "original", size: "43.67 MiB", cost: "916 GP" },
        { kind: "hath", resolution: "800x", size: "2.76 MiB", cost: "58 GP" },
        { kind: "hath", resolution: "1280x", size: "5.68 MiB", cost: "120 GP" },
      ],
    });
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