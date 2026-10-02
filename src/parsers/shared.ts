import type { EhSite } from "../types.js";
import { EhError } from "../errors.js";

export function assertNotChallengePage(html: string, site: EhSite = "e-hentai"): void {
  if (/Just a moment|challenge-platform|cf-chl-|cf_chl_/i.test(html)) {
    throw new EhError("CLOUDFLARE_CHALLENGE", "E-Hentai returned a Cloudflare challenge page; refresh the browser session or EH_CF_CLEARANCE cookie", { retryable: false, site, stage: "html-parser" });
  }
  if (/<title>\s*E-Hentai\.org Login\s*<\/title>|name=["']ipb_login_form["']/i.test(html)) {
    throw new EhError("AUTH_REJECTED", "E-Hentai returned a login page; credentials expired or were rejected", { retryable: false, site, stage: "html-parser" });
  }
  const banMatch = html.match(/Your IP address has been temporarily banned for excessive pageloads[\s\S]*?The ban expires in\s+([^<\r\n]+)/i);
  if (banMatch) {
    throw new EhError("RATE_LIMITED", `E-Hentai IP temporarily banned for ${banMatch[1]!.trim()}; stop requests until the ban expires`, { retryable: false, site, stage: "html-parser" });
  }
}
