import { describe, expect, it, vi } from "vitest";
import { EhClient } from "../src/client.js";
import { SerialRateLimiter } from "../src/rate-limiter.js";

const noWait = () => new SerialRateLimiter(0);
const pageHtml = (total: number, start: number, count: number) => `<div id="gdd">Length: ${total} pages</div><div id="gdt">${Array.from({ length: count }, (_, offset) => {
  const page = start + offset;
  const token = page.toString(16).padStart(10, "0");
  return `<a href="https://e-hentai.org/s/${token}/123-${page}"><img src="https://ehgt.org/${page}.jpg"></a>`;
}).join("")}</div>`;

describe("complete gallery page enumeration", () => {
  it("loads every preview page, deduplicates, and orders image pages", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const previewPage = Number(new URL(String(url)).searchParams.get("p") ?? 0);
      if (previewPage === 0) return new Response(pageHtml(45, 1, 20));
      if (previewPage === 1) return new Response(pageHtml(45, 21, 20));
      return new Response(pageHtml(45, 40, 6));
    });
    const client = new EhClient({ fetch: fetchMock as typeof fetch, pageLimiter: noWait() });
    const result = await client.getAllGalleryPages({ gid: 123, token: "123456789a" }, "e-hentai", 50);
    expect(result.totalPages).toBe(45);
    expect(result.previewPagesFetched).toBe(3);
    expect(result.pages).toHaveLength(45);
    expect(result.pages[0]?.page).toBe(1);
    expect(result.pages.at(-1)?.page).toBe(45);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("rejects galleries above maxImages before fetching additional preview pages", async () => {
    const fetchMock = vi.fn(async () => new Response(pageHtml(1000, 1, 20)));
    const client = new EhClient({ fetch: fetchMock as typeof fetch, pageLimiter: noWait() });
    await expect(client.getAllGalleryPages({ gid: 123, token: "123456789a" }, "e-hentai", 500)).rejects.toThrow("exceeds maxImages");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
