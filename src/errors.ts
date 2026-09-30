import type { EhSite } from "./types.js";

export const EH_ERROR_CODES = [
  "INVALID_INPUT",
  "AUTH_REQUIRED",
  "AUTH_REJECTED",
  "NOT_FOUND",
  "EXPUNGED",
  "CLOUDFLARE_CHALLENGE",
  "RATE_LIMITED",
  "UPSTREAM_ERROR",
  "PARSE_ERROR",
  "NETWORK_ERROR",
] as const;

export type EhErrorCode = (typeof EH_ERROR_CODES)[number];

export interface EhErrorOptions {
  retryable: boolean;
  site?: EhSite;
  stage?: string;
  status?: number;
  cause?: unknown;
}

export interface EhErrorJSON {
  code: EhErrorCode;
  message: string;
  retryable: boolean;
  site?: EhSite;
  stage?: string;
  status?: number;
}

export interface EhErrorContext {
  site?: EhSite;
  stage?: string;
  status?: number;
}

export class EhError extends Error {
  readonly code: EhErrorCode;
  readonly retryable: boolean;
  readonly site?: EhSite;
  readonly stage?: string;
  readonly status?: number;

  constructor(code: EhErrorCode, message: string, options: EhErrorOptions) {
    super(message, { cause: options.cause });
    this.name = "EhError";
    this.code = code;
    this.retryable = options.retryable;
    this.site = options.site;
    this.stage = options.stage;
    this.status = options.status;
  }

  toJSON(): EhErrorJSON {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      ...(this.site ? { site: this.site } : {}),
      ...(this.stage ? { stage: this.stage } : {}),
      ...(this.status !== undefined ? { status: this.status } : {}),
    };
  }
}

function inferredError(error: unknown): Pick<EhErrorOptions, "retryable"> & { code: EhErrorCode } {
  const message = error instanceof Error ? error.message : String(error);
  if (/Cloudflare challenge|challenge page/i.test(message)) {
    return { code: "CLOUDFLARE_CHALLENGE", retryable: false };
  }
  if (/login page|credentials? (?:expired|were rejected)|credentials?.*rejected/i.test(message)) {
    return { code: "AUTH_REJECTED", retryable: false };
  }
  if (/requires? EH_|require.*credentials|authentication required/i.test(message)) {
    return { code: "AUTH_REQUIRED", retryable: false };
  }
  if (/temporarily banned|rate limited|quota exhausted/i.test(message)) {
    return { code: "RATE_LIMITED", retryable: false };
  }
  if (/malformed|could not find|cannot find|expected .* received|incomplete|invalid .* page/i.test(message)) {
    return { code: "PARSE_ERROR", retryable: false };
  }
  return { code: "UPSTREAM_ERROR", retryable: false };
}

export function ehErrorFromUnknown(error: unknown, context: EhErrorContext = {}): EhError {
  if (error instanceof EhError) {
    if (!context.site && !context.stage && context.status === undefined) return error;
    return new EhError(error.code, error.message, {
      retryable: error.retryable,
      site: error.site ?? context.site,
      stage: error.stage ?? context.stage,
      status: error.status ?? context.status,
      cause: error,
    });
  }

  const message = error instanceof Error ? error.message : String(error);
  const inferred = inferredError(error);
  return new EhError(inferred.code, message, {
    retryable: inferred.retryable,
    ...context,
    cause: error,
  });
}

export function networkErrorContext(error: unknown, context: EhErrorContext): EhError {
  if (error instanceof EhError) return ehErrorFromUnknown(error, context);
  const message = error instanceof Error ? error.message : String(error);
  return new EhError("NETWORK_ERROR", message, {
    retryable: true,
    ...context,
    cause: error,
  });
}
