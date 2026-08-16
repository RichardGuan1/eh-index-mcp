import { describe, expect, it } from "vitest";
import { parseGalleryList } from "../src/parsers.js";

const ref = {
  href: "https://e-hentai.org/g/123/123456789a/",
  title: "Synthetic Gallery",
  thumbnail: "https://ehgt.org/synthetic-thumb.jpg",
};

const tableRow = (cells: string) => `<table class="itg"><tr>${cells}</tr></table>`;

const modes = [
  {
    name: "minimal",
    html: tableRow(`
      <td class="gl1m glcat"><div class="cn">Manga</div></td>
      <td class="gl2m"><div class="glthumb"><img data-src="${ref.thumbnail}"></div><div id="posted_123">2026-08-17 01:00</div><div>42 pages</div></td>
      <td class="gl3m glname"><a href="${ref.href}"><div class="glink">${ref.title}</div></a></td>
      <td class="gl4m"><div class="ir" title="4.5"></div></td>
    `),
  },
  {
    name: "minimal+",
    html: tableRow(`
      <td class="gl1m glcat"><div class="cn">Manga</div></td>
      <td class="gl2m"><div class="glthumb"><img src="${ref.thumbnail}"></div><div id="posted_123">2026-08-17 01:00</div><div>42 pages</div></td>
      <td class="gl3m glname"><a href="${ref.href}"><div class="glink">${ref.title}</div></a><div class="gt" title="language:english"></div></td>
      <td class="gl4m"><div class="ir" title="4.5"></div></td>
    `),
  },
  {
    name: "compact",
    html: tableRow(`
      <td class="gl1c glcat"><div class="cs">Manga</div></td>
      <td class="gl2c"><div class="glthumb"><img data-src="${ref.thumbnail}"></div><div id="posted_123">2026-08-17 01:00</div><div>42 pages</div></td>
      <td class="gl3c glname"><a href="${ref.href}"><div class="glink">${ref.title}</div></a><div class="gtl" title="language:english"></div></td>
      <td class="gl4c"><div class="ir" title="4.5"></div></td>
    `),
  },
  {
    name: "extended",
    html: tableRow(`
      <td class="gl1e"><div><a href="${ref.href}"><img data-src="${ref.thumbnail}"></a></div></td>
      <td class="gl2e">
        <div class="gl3e"><div class="cn">Manga</div><div id="posted_123">2026-08-17 01:00</div><div>42 pages</div></div>
        <div class="glname"><a href="${ref.href}"><div class="glink">${ref.title}</div></a></div>
        <div class="ir" title="4.5"></div><div class="gt" title="language:english"></div>
      </td>
    `),
  },
  {
    name: "thumbnail",
    html: `<div class="itg gld"><div class="gl1t">
      <div class="gl4t glname"><a href="${ref.href}"><span class="glink">${ref.title}</span></a></div>
      <div class="gl3t"><a href="${ref.href}"><img data-src="${ref.thumbnail}"></a></div>
      <div class="gl5t"><div class="cn">Manga</div><div id="posted_123">2026-08-17 01:00</div><div>42 pages</div><div class="ir" title="4.5"></div></div>
    </div></div>`,
  },
] as const;

describe("gallery list display modes", () => {
  it.each(modes)("parses the $name layout", ({ html }) => {
    expect(parseGalleryList(html).galleries).toEqual([
      expect.objectContaining({
        gid: 123,
        token: "123456789a",
        title: ref.title,
        category: "Manga",
        posted: "2026-08-17 01:00",
        pages: 42,
        rating: 4.5,
        thumbnailUrl: ref.thumbnail,
      }),
    ]);
  });
});
