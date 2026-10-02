import { load } from "cheerio";
import type { EhSite, GalleryComment, GalleryTorrent } from "../types.js";
import { assertNotChallengePage } from "./shared.js";

function numberFromText(value: string, fallback = 0): number {
  const number = Number.parseInt(value.replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(number) ? number : fallback;
}

export function parseGalleryComments(html: string, site: EhSite = "e-hentai"): GalleryComment[] {
  assertNotChallengePage(html, site);
  const $ = load(html);
  return $("#cdiv .c1").map((_, comment) => {
    const node = $(comment);
    const body = node.find(".c6[id^='comment_']").first();
    const id = Number(body.attr("id")?.replace("comment_", ""));
    if (!Number.isInteger(id) || id < 0) return null;
    const header = node.find(".c3").first();
    const headerText = header.text().replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    const posted = headerText.match(/^Posted on\s+(.+?)\s+by:/i)?.[1]?.trim() ?? null;
    const author = header.find("a[href*='/uploader/']").first().text().trim() || null;
    const scoreText = node.find(`#comment_score_${id}`).first().text().trim();
    const score = scoreText ? Number.parseInt(scoreText, 10) : null;
    body.find("br").replaceWith("\n");
    const text = body.text().replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    const votes = node.find(`#cvotes_${id}`).first().text().replace(/\s+/g, " ").trim() || null;
    return { id, author, posted, score: Number.isFinite(score) ? score : null, uploaderComment: id === 0 || node.find(".c4").text().includes("Uploader Comment"), text, votes, untrusted: true as const };
  }).get().filter((comment): comment is GalleryComment => comment !== null);
}

export function parseTorrents(html: string, site: EhSite = "e-hentai"): GalleryTorrent[] {
  assertNotChallengePage(html, site);
  const $ = load(html);
  return $("#torrentinfo form").map((_, form) => {
    const formNode = $(form);
    const id = numberFromText(formNode.find("input[name='gtid']").first().attr("value") ?? "", -1);
    const link = formNode.find("a[href$='.torrent']").first();
    const field = (label: string): string => {
      const cell = formNode.find("td").filter((__, node) => $(node).find("span").first().text().trim() === `${label}:`).first();
      return cell.text().replace(new RegExp(`^${label}:\\s*`, "i"), "").trim();
    };
    const uploaderCell = formNode.find("td").filter((__, cell) => $(cell).find("span").first().text().trim() === "Uploader:").first();
    const outdated = formNode.prevAll("p").first().text().toLowerCase().includes("outdated");
    return { id, name: link.text().trim(), url: link.attr("href") ?? "", posted: field("Posted"), size: field("Size"), seeds: numberFromText(field("Seeds")), peers: numberFromText(field("Peers")), downloads: numberFromText(field("Downloads")), uploader: uploaderCell.text().replace(/^Uploader:\s*/i, "").trim() || null, outdated };
  }).get().filter((torrent) => torrent.id >= 0 && torrent.url);
}
