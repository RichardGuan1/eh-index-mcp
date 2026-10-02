import type { EhSite, IdentityCookies } from "../types.js";
import { EhError } from "../errors.js";

export function isLoginPage(html: string): boolean {
  return /<title>\s*E-Hentai\.org Login\s*<\/title>|name=["']ipb_login_form["']/i.test(html);
}

export function authRejected(message: string, site: EhSite, stage: string): EhError {
  return new EhError("AUTH_REJECTED", message, { retryable: false, site, stage });
}

export function authRequired(message: string, site: EhSite, stage: string): EhError {
  return new EhError("AUTH_REQUIRED", message, { retryable: false, site, stage });
}

export function validateCookies(cookies: IdentityCookies | undefined): void {
  if (!cookies) return;
  const values: Array<[string, string | undefined]> = [
    ["EH_MEMBER_ID", cookies.memberId],
    ["EH_PASS_HASH", cookies.passHash],
    ["EH_IGNEOUS", cookies.igneous],
    ["EH_CF_CLEARANCE", cookies.cfClearance],
  ];
  for (const [name, value] of values) {
    if (value && !/^[A-Za-z0-9._~-]+$/.test(value)) {
      throw new Error(`${name} contains characters that are unsafe in a Cookie header`);
    }
  }
}
